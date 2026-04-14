from fastapi import APIRouter, Depends, Request
from src.schemas.chat import ChatRequest, ChatResponse
from src.services.session_store import SessionStore
from src.services.dummyjson_client import DummyJsonClient
from src.core.pipeline import run_turn
from src.core.errors import AgentError, PipelineTimeoutError
import structlog

router = APIRouter()
logger = structlog.get_logger()


def get_session_store(request: Request) -> SessionStore:
    return request.app.state.session_store


def get_dummyjson_client(request: Request) -> DummyJsonClient:
    return request.app.state.dummyjson_client


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    store: SessionStore = Depends(get_session_store),
    client: DummyJsonClient = Depends(get_dummyjson_client),
) -> ChatResponse:
    session = store.get(request.sessionId)
    try:
        updated_session, response = await run_turn(session, request.message, client)
        store.save(request.sessionId, updated_session)
        return response
    except (AgentError, PipelineTimeoutError) as e:
        logger.error("pipeline_error", error=str(e), session_id=request.sessionId)
        return ChatResponse(message="I hit a hiccup — could you rephrase?", products=[])
    except Exception as e:
        logger.exception("unexpected_error", session_id=request.sessionId)
        return ChatResponse(message="Something went wrong. Please try again.", products=[])
