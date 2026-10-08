from app.services import email_service
from tests.test_workflow import _apply, _setup

A = "/api/v1/admin"
post = lambda client, path, body, h=None: client.post(f"/api/v1{path}", json=body, headers=h or {})
outbox = lambda: email_service.OUTBOX


def _token_from_email(i=-1):
    return outbox()[i]["body"].split("token=")[1].split()[0]


def test_forgot_and_reset_password(client, make_user):
    make_user("c@c.com", "CREATOR", "Aisha")
    assert post(client, "/auth/forgot-password", {"email": "c@c.com"}).status_code == 200
    assert post(client, "/auth/forgot-password", {"email": "nobody@c.com"}).json()["message"] == post(client, "/auth/forgot-password", {"email": "c@c.com"}).json()["message"]
    assert [m["to"] for m in outbox()] == ["c@c.com", "c@c.com"]  # nothing sent for the unknown address
    token = _token_from_email(0)

    assert post(client, "/auth/reset-password", {"token": token, "password": "short"}).status_code == 422
    assert post(client, "/auth/reset-password", {"token": "garbage", "password": "newpassword1"}).json()["error"]["code"] == "INVALID_TOKEN"
    assert post(client, "/auth/reset-password", {"token": token, "password": "newpassword1"}).status_code == 200
    assert post(client, "/auth/login", {"email": "c@c.com", "password": "secret123"}).status_code == 401
    assert post(client, "/auth/login", {"email": "c@c.com", "password": "newpassword1"}).status_code == 200
    assert post(client, "/auth/reset-password", {"token": token, "password": "another-pass1"}).json()["error"]["code"] == "INVALID_TOKEN"  # single use
    assert any("password was changed" in m["subject"] for m in outbox())
    assert post(client, "/auth/reset-password", {"token": _token_from_email(1), "password": "x" * 8 + "1"}).status_code == 400  # older link died with the password change


def test_reset_token_cannot_be_used_as_access_token(client, make_user):
    make_user("c@c.com", "CREATOR", "Aisha")
    post(client, "/auth/forgot-password", {"email": "c@c.com"})
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {_token_from_email()}"}).status_code == 401


def test_auth_rate_limits(client, make_user):
    make_user("c@c.com", "CREATOR", "Aisha")
    assert [post(client, "/auth/forgot-password", {"email": "c@c.com"}).status_code for _ in range(6)] == [200] * 5 + [429]
    codes = [post(client, "/auth/login", {"email": "z@c.com", "password": "wrongwrong"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_suspended_user_gets_no_reset_email(client, make_user, admin):
    make_user("c@c.com", "CREATOR", "Aisha")
    uid = client.get(A + "/users?q=c@c.com", headers=admin).json()["data"]["items"][0]["id"]
    client.post(f"{A}/users/{uid}/suspend", json={"suspended": True}, headers=admin)
    post(client, "/auth/forgot-password", {"email": "c@c.com"})
    assert outbox() == []


def test_notification_emails_and_opt_out(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    _apply(client, c1, pid)
    assert [(m["to"], m["subject"]) for m in outbox()] == [("b@b.com", "New application")]
    assert "/dashboard/brand/projects/" in outbox()[0]["body"] and "turn these emails off" in outbox()[0]["body"]
    outbox().clear()
    assert client.get("/api/v1/users/me", headers=brand).json()["data"]["email_notifications"] is True
    assert client.patch("/api/v1/users/me", json={"email_notifications": False}, headers=brand).json()["data"]["email_notifications"] is False
    _apply(client, c2, pid)
    assert outbox() == []  # opted out, but the in-app notification still exists
    assert len(client.get("/api/v1/notifications", headers=brand).json()["data"]["items"]) == 2
    assert client.patch("/api/v1/users/me", json={"email_notifications": False}).status_code == 401


def test_emails_are_not_sent_when_the_action_fails(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    _apply(client, c1, pid)
    outbox().clear()
    assert _apply(client, c1, pid).status_code == 409  # duplicate, rolled back before notify
    assert outbox() == []


def test_audit_log(client, make_user, admin):
    c = make_user("c@c.com", "CREATOR", "Aisha")
    brand = make_user("b@b.com", "BRAND", "Acme")
    cid = client.get("/api/v1/creators/me", headers=c).json()["data"]["id"]
    uid = client.get(A + "/users?q=c@c.com", headers=admin).json()["data"]["items"][0]["id"]
    client.post(f"{A}/creators/{cid}/verify", json={"verified": True}, headers=admin)
    client.post(f"{A}/creators/{cid}/feature", json={"featured": True}, headers=admin)
    client.post(f"{A}/users/{uid}/suspend", json={"suspended": True}, headers=admin)
    client.post(A + "/categories/niches", json={"name": "Real Estate"}, headers=admin)
    client.post(f"{A}/users/{uid}/suspend", json={"suspended": True}, headers=brand)  # forbidden, must not be logged
    log = client.get(A + "/audit", headers=admin).json()["data"]
    assert [a["action"] for a in log["items"]] == ["ADD_CATEGORY", "SUSPEND_USER", "FEATURE_CREATOR", "VERIFY_CREATOR"]
    assert log["items"][1]["summary"] == "Suspended c@c.com" and log["items"][0]["admin"] == "admin@x.com"
    assert client.get(A + "/audit", headers=brand).status_code == 403
