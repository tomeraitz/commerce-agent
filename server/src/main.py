from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.health import router as health_router
from src.api.chat import router as chat_router
from src.services.session_store import InMemorySessionStore
from src.services.dummyjson_client import DummyJsonClient
from src.config import settings
from src.middleware import setup_logging, RequestLoggingMiddleware, error_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.session_store = InMemorySessionStore()
    app.state.dummyjson_client = DummyJsonClient(settings.dummyjson_base_url)
    yield
    await app.state.dummyjson_client.close()


def create_app() -> FastAPI:
    setup_logging(settings.log_level)

    app = FastAPI(title="AI Shopping Copilot", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.add_exception_handler(Exception, error_handler)
    app.include_router(health_router)
    app.include_router(chat_router)
    return app


app = create_app()
