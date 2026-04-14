import asyncio

import structlog
from pydantic import ValidationError

from src.schemas import ChatResponse, Intent, IntentType, Product, Recommendation, Requirements
from src.services.session_store import Session
from src.services.search_planner import build_search_plan
from src.services.post_filters import apply_filters, sort_and_slice
from src.services.dummyjson_client import DummyJsonClient
from src.agents.orchestrator import classify_intent
from src.agents.sales import run_sales, SalesDecision
from src.agents.recommendation import recommend
from src.core.errors import AgentError, PipelineTimeoutError

logger = structlog.get_logger()

TURN_TIMEOUT = 20.0


async def run_turn(
    session: Session,
    message: str,
    client: DummyJsonClient,
) -> tuple[Session, ChatResponse]:
    """Execute one conversation turn. Returns (updated_session, response)."""
    try:
        return await asyncio.wait_for(
            _run_pipeline(session, message, client),
            timeout=TURN_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise PipelineTimeoutError(f"Turn exceeded {TURN_TIMEOUT}s budget")


async def _run_pipeline(
    session: Session,
    message: str,
    client: DummyJsonClient,
) -> tuple[Session, ChatResponse]:
    # ── Step 1: Classify intent ──────────────────────────────────────
    try:
        intent = await classify_intent(message, session.history)
    except ValidationError as exc:
        logger.warning(
            "classify_intent structured-output validation failed",
            raw_output=str(exc)[:500],
        )
        intent = Intent(
            intent=IntentType.product_discovery,
            route_to="sales",
            context="fallback_validation_error",
        )
    except Exception:
        logger.warning("classify_intent failed, falling back to product_discovery")
        intent = Intent(
            intent=IntentType.product_discovery,
            route_to="sales",
            context="fallback",
        )

    logger.info("intent_classified", intent=intent.intent.value, route=intent.route_to)

    # ── Step 2: Short-circuit branches ───────────────────────────────
    if intent.intent in (IntentType.greeting, IntentType.out_of_scope):
        response_msg = intent.direct_response or "Hello! How can I help you find products today?"
        response = ChatResponse(message=response_msg, products=[])
        _update_session(session, message, response_msg)
        return session, response

    if intent.intent == IntentType.product_detail:
        product_id = _extract_product_id(intent.context)
        if product_id is not None:
            try:
                product = await client.get_by_id(product_id)
                response = ChatResponse(
                    message=f"Here are the details for {product.title}.",
                    products=[product],
                )
                _update_session(session, message, response.message, products=[product])
                return session, response
            except Exception:
                logger.warning("get_by_id failed", product_id=product_id)
                response = ChatResponse(
                    message="Sorry, I couldn't find that product.",
                    products=[],
                )
                _update_session(session, message, response.message)
                return session, response
        # If we can't extract an ID, fall through to sales flow
        intent = Intent(
            intent=IntentType.product_discovery,
            route_to="sales",
            context="product_detail_fallback",
        )

    if intent.intent == IntentType.comparison and session.last_products:
        requirements = session.requirements or Requirements()
        try:
            rec = await recommend(session.last_products, requirements, message)
            response = ChatResponse(
                message=rec.message,
                products=session.last_products,
                recommendation=rec,
            )
            _update_session(session, message, response.message, products=session.last_products)
            return session, response
        except ValidationError as exc:
            logger.warning("recommend structured-output validation failed (comparison)", raw_output=str(exc)[:500])
            response = ChatResponse(
                message="Here are the products I found previously. Let me know if you need more help!",
                products=session.last_products,
            )
            _update_session(session, message, response.message, products=session.last_products)
            return session, response
        except Exception:
            logger.warning("recommend failed for comparison")
            response = ChatResponse(
                message="Here are the products I found previously. Let me know if you need more help!",
                products=session.last_products,
            )
            _update_session(session, message, response.message, products=session.last_products)
            return session, response

    # ── Step 3: Sales agent (product_discovery / follow_up) ──────────
    try:
        sales_result = await run_sales(message, session.history, session.requirements)
    except ValidationError as exc:
        logger.error(
            "sales agent structured-output validation failed",
            raw_output=str(exc)[:500],
        )
        raise AgentError(f"Sales agent validation failed: {exc}") from exc
    except Exception as exc:
        raise AgentError(f"Sales agent failed: {exc}") from exc

    logger.info(
        "sales_decision",
        action=sales_result.action,
        has_requirements=sales_result.requirements is not None,
    )

    if sales_result.action == "ask_user":
        if sales_result.requirements:
            session.requirements = sales_result.requirements
        response = ChatResponse(message=sales_result.message, products=[])
        _update_session(session, message, sales_result.message)
        return session, response

    # action == "search" — proceed
    requirements = sales_result.requirements or session.requirements or Requirements()
    session.requirements = requirements

    # ── Step 4: Execute search plan ──────────────────────────────────
    try:
        plan = build_search_plan(requirements)
        logger.info(
            "search_plan_built",
            api_calls=[c.path for c in plan.api_calls],
            limit=plan.limit,
            post_filters=plan.post_filters.model_dump(),
            requirements=requirements.model_dump(exclude_none=True),
        )
        raw_products = await client.execute_plan(plan)
        logger.info(
            "search_raw_count",
            n=len(raw_products),
            sample_prices=[p.price for p in raw_products[:5]],
            sample_titles=[p.title for p in raw_products[:5]],
        )
    except Exception as exc:
        logger.warning("search_plan execution failed", error=str(exc))
        response = ChatResponse(
            message="Sorry, I had trouble searching for products. Please try again.",
            products=[],
        )
        _update_session(session, message, response.message)
        return session, response

    # ── Step 5: Post-filter ──────────────────────────────────────────
    filtered = apply_filters(raw_products, plan.post_filters)
    logger.info("search_filtered_count", n=len(filtered))
    products = sort_and_slice(
        filtered,
        requirements.sort_by,
        requirements.sort_order,
        plan.limit,
    )
    logger.info("search_final_count", n=len(products))

    # ── Step 6: Recommendation (conditional) ─────────────────────────
    should_recommend = (
        len(products) >= 2
        or intent.intent == IntentType.comparison
        or requirements.priority in ("quality", "price")
    )

    recommendation: Recommendation | None = None
    response_msg = sales_result.message

    if should_recommend and products:
        try:
            recommendation = await recommend(products, requirements, message)
            response_msg = recommendation.message
        except ValidationError as exc:
            logger.warning("recommend structured-output validation failed", raw_output=str(exc)[:500])
        except Exception:
            logger.warning("recommend failed, returning products without recommendation")
            # Keep sales_result.message as response_msg

    response = ChatResponse(
        message=response_msg,
        products=products,
        recommendation=recommendation,
    )
    _update_session(session, message, response_msg, products=products)
    return session, response


def _extract_product_id(context: str) -> int | None:
    """Try to extract a numeric product ID from the intent context string."""
    import re
    match = re.search(r"\d+", context or "")
    if match:
        return int(match.group())
    return None


def _update_session(
    session: Session,
    user_message: str,
    assistant_message: str,
    products: list[Product] | None = None,
) -> None:
    """Mutate session with the latest turn data."""
    session.history.append({"role": "user", "content": user_message})
    session.history.append({"role": "assistant", "content": assistant_message})
    if products is not None:
        session.last_products = products
