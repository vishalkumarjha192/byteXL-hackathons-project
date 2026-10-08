import pytest

from app.config import settings
from app.services import payment_providers
from tests.test_workflow import PROPOSAL, _apply, _setup


def _to_final(client, brand, c1, pid, price=5000):
    app_id = _apply(client, c1, pid, price).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    client.post("/api/v1/deliverables", headers=c1, json={"project_id": pid, "file_url": "https://example.com/f.mp4", "kind": "FINAL"})
    client.post(f"/api/v1/projects/{pid}/approve", headers=brand)


def _pay(client, h, pid):
    return client.get(f"/api/v1/projects/{pid}/workspace", headers=h).json()["data"]["payment"]


def test_payment_created_on_hire_with_configurable_fee(client, make_user, monkeypatch):
    brand, c1, c2, pid = _setup(client, make_user)
    _apply(client, c1, pid, 5000)
    app_id = client.get("/api/v1/applications/mine", headers=c1).json()["data"][0]["id"]
    monkeypatch.setattr(settings, "PLATFORM_FEE_PERCENT", 10.0)
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    pay = _pay(client, brand, pid)
    assert (pay["status"], pay["amount"], pay["platform_fee"], pay["creator_amount"]) == ("PENDING", 5000, 500, 4500)


def test_fund_release_and_earnings(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    other = make_user("o@b.com", "BRAND", "Other")
    _to_final(client, brand, c1, pid)
    assert _pay(client, brand, pid)["status"] == "PENDING"
    assert client.post(f"/api/v1/projects/{pid}/complete", headers=brand).json()["error"]["code"] == "PAYMENT_REQUIRED"
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=other).status_code == 403
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=c1).status_code == 403
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand).status_code == 200
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand).json()["error"]["code"] == "INVALID_PAYMENT_STATE"
    mid = client.get("/api/v1/payments/mine", headers=c1).json()["data"]["summary"][0]
    assert (mid["in_escrow"], mid["available"]) == (4000, 0)

    assert client.post(f"/api/v1/projects/{pid}/complete", headers=brand).json()["data"]["status"] == "COMPLETED"
    assert _pay(client, c1, pid)["status"] == "RELEASED"
    notes = [n["type"] for n in client.get("/api/v1/notifications", headers=c1).json()["data"]["items"]]
    assert "PROJECT_FUNDED" in notes and "PAYMENT_RELEASED" in notes

    mine = client.get("/api/v1/payments/mine", headers=c1).json()["data"]
    assert mine["role"] == "CREATOR" and mine["summary"][0]["earned"] == 4000 and mine["summary"][0]["available"] == 4000
    assert mine["items"][0]["project_title"] == "30s skincare Reel" and len(mine["monthly"]) == 1
    spend = client.get("/api/v1/payments/mine", headers=brand).json()["data"]["summary"][0]
    assert spend["spent"] == 5000

    w = lambda h, amount, cur="INR": client.post("/api/v1/payments/withdraw", headers=h, json={"amount": amount, "currency": cur})
    assert w(brand, 100).status_code == 403
    assert w(c1, 4500).json()["error"]["code"] == "INSUFFICIENT_BALANCE"
    assert w(c1, 100, "USD").json()["error"]["code"] == "INSUFFICIENT_BALANCE"
    assert w(c1, 0).status_code == 422
    assert w(c1, 1500).json()["data"]["available"] == 2500
    after = client.get("/api/v1/payments/mine", headers=c1).json()["data"]
    assert after["summary"][0]["available"] == 2500 and after["summary"][0]["withdrawn"] == 1500 and len(after["payouts"]) == 1


def test_cancel_refunds_funded_and_cancels_unfunded(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    app_id = _apply(client, c1, pid).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand)
    client.post(f"/api/v1/projects/{pid}/cancel", headers=brand)
    assert _pay(client, brand, pid)["status"] == "REFUNDED"

    brand2, d1, d2, pid2 = _setup_second(client, make_user)
    app2 = _apply(client, d1, pid2).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app2}/accept", headers=brand2)
    client.post(f"/api/v1/projects/{pid2}/cancel", headers=brand2)
    assert _pay(client, brand2, pid2)["status"] == "CANCELLED"


def _setup_second(client, make_user):
    from tests.test_workflow import JOB
    brand = make_user("b2@b.com", "BRAND", "Second")
    c1 = make_user("d1@c.com", "CREATOR", "Dia")
    c2 = make_user("d2@c.com", "CREATOR", "Eli")
    return brand, c1, c2, client.post("/api/v1/projects", json=JOB, headers=brand).json()["data"]["id"]


def test_provider_is_pluggable(monkeypatch):
    assert payment_providers.get_provider().name == "mock"
    assert payment_providers.get_provider().create_payment(100, "INR", "x").startswith("mock_pay_")
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "nope")
    with pytest.raises(RuntimeError):
        payment_providers.get_provider()
