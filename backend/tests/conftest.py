import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.create_admin import create_admin
from app.database import Base, get_db
from app.main import app
from app.config import settings
from app.seed_lookups import seed_lookups
from app.services import email_service
from app.utils import ratelimit


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "memory")
    email_service.OUTBOX.clear()
    for limiter in ratelimit.ALL:
        limiter.hits.clear()


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    with Session() as db:
        seed_lookups(db)
    return Session


@pytest.fixture()
def client(session_factory):
    def override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def make_user(client):
    def _make(email, role, name="Test"):
        client.post("/api/v1/auth/register", json={"email": email, "password": "secret123", "role": role, "name": name})
        tok = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"}).json()["data"]
        return {"Authorization": f"Bearer {tok['access_token']}"}

    return _make


@pytest.fixture()
def admin(client, session_factory):
    with session_factory() as db:
        create_admin(db, "admin@x.com", "secret123")
    tok = client.post("/api/v1/auth/login", json={"email": "admin@x.com", "password": "secret123"}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}
