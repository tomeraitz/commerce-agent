import pytest
import structlog
from structlog.testing import capture_logs
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.middleware.logging import setup_logging, RequestLoggingMiddleware
from src.middleware.errors import error_handler


def _make_app() -> FastAPI:
    """Create a minimal FastAPI app with our middleware wired in."""
    setup_logging("DEBUG")

    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)
    app.add_exception_handler(Exception, error_handler)

    @app.get("/ok")
    async def ok():
        return {"status": "ok"}

    @app.get("/boom")
    async def boom():
        raise RuntimeError("something broke")

    return app


@pytest.fixture()
def app():
    return _make_app()


@pytest.fixture()
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def test_request_logging_success(client):
    """A successful request produces a log event with the expected fields."""
    with capture_logs() as logs:
        resp = client.get("/ok")

    assert resp.status_code == 200
    assert "X-Correlation-ID" in resp.headers

    completed = [e for e in logs if e.get("event") == "request_completed"]
    assert len(completed) == 1
    entry = completed[0]
    assert entry["method"] == "GET"
    assert entry["path"] == "/ok"
    assert entry["status"] == 200
    assert "duration_ms" in entry


def test_request_logging_error(client):
    """An error during request handling produces an unhandled_error log event."""
    with capture_logs() as logs:
        resp = client.get("/boom")

    # The error handler converts to 500 JSON
    assert resp.status_code == 500
    body = resp.json()
    assert body["message"] == "An internal error occurred."
    assert "correlation_id" in body

    # The error_handler logs an "unhandled_error" event
    error_logs = [e for e in logs if e.get("event") == "unhandled_error"]
    assert len(error_logs) == 1
    assert error_logs[0]["error_type"] == "RuntimeError"


def test_error_handler_returns_json_with_correlation_id(client):
    """The error handler JSON body includes the correlation_id from the middleware."""
    with capture_logs():
        resp = client.get("/boom")

    body = resp.json()
    assert "correlation_id" in body
    # The correlation_id should be 8 chars (uuid[:8])
    assert len(body["correlation_id"]) == 8
