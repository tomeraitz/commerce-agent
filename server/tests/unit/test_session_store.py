from src.schemas.product import Product
from src.schemas.requirements import Requirements
from src.services.session_store import InMemorySessionStore, Session


def test_get_missing_session_returns_empty():
    store = InMemorySessionStore()
    session = store.get("unknown-id")
    assert session.history == []
    assert session.requirements is None
    assert session.last_products == []


def test_save_and_get():
    store = InMemorySessionStore()
    session = Session(
        history=[{"role": "user", "content": "hello"}],
        requirements=Requirements(category="laptops"),
        last_products=[],
    )
    store.save("s1", session)
    retrieved = store.get("s1")
    assert retrieved.history == [{"role": "user", "content": "hello"}]
    assert retrieved.requirements is not None
    assert retrieved.requirements.category == "laptops"


def test_save_overwrites_previous():
    store = InMemorySessionStore()
    store.save("s1", Session(history=[{"role": "user", "content": "first"}]))
    store.save("s1", Session(history=[{"role": "user", "content": "second"}]))
    retrieved = store.get("s1")
    assert retrieved.history == [{"role": "user", "content": "second"}]


def test_clear_removes_session():
    store = InMemorySessionStore()
    store.save("s1", Session(history=[{"role": "user", "content": "hi"}]))
    store.clear("s1")
    session = store.get("s1")
    assert session.history == []


def test_clear_nonexistent_does_not_raise():
    store = InMemorySessionStore()
    store.clear("nonexistent")  # should not raise
