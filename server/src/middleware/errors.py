import structlog
from fastapi import Request
from fastapi.responses import JSONResponse

logger = structlog.get_logger()


async def error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Convert unhandled exceptions to JSON responses with correlation id."""
    correlation_id = structlog.contextvars.get_contextvars().get(
        "correlation_id", "unknown"
    )

    logger.exception(
        "unhandled_error",
        error_type=type(exc).__name__,
        error=str(exc),
    )

    return JSONResponse(
        status_code=500,
        content={
            "message": "An internal error occurred.",
            "correlation_id": correlation_id,
        },
    )
