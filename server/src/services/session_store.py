from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from src.schemas.product import Product
from src.schemas.requirements import Requirements


@dataclass
class Session:
    history: list[dict] = field(default_factory=list)
    requirements: Requirements | None = None
    last_products: list[Product] = field(default_factory=list)


class SessionStore(Protocol):
    def get(self, session_id: str) -> Session: ...
    def save(self, session_id: str, session: Session) -> None: ...
    def clear(self, session_id: str) -> None: ...


class InMemorySessionStore:
    def __init__(self) -> None:
        self._store: dict[str, Session] = {}

    def get(self, session_id: str) -> Session:
        if session_id not in self._store:
            return Session()
        return self._store[session_id]

    def save(self, session_id: str, session: Session) -> None:
        self._store[session_id] = session

    def clear(self, session_id: str) -> None:
        self._store.pop(session_id, None)
