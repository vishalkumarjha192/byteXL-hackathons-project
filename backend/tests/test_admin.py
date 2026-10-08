import pytest

from app.create_admin import create_admin
from tests.test_workflow import JOB, PROPOSAL, _apply, _setup

A = "/api/v1/admin"


def _creator_id(client, h):
    return client.get("/api/v1/creators/me", headers=h).json()["data"]["id"]


def test_admin_only(client, make_user, admin):
    brand, creator = make_user("b@b.com", "BRAND", "Acme"), make_user("c@c.com", "CREATOR", "Aisha")
    for path in ("/stats", "/users", "/creators", "/brands", "/projects", "/payments", "/reports", "/categories"):
        assert client.get(A + path, headers=brand).status_code == 403
        assert client.get(A + path, headers=creator).status_code == 403
        assert client.get(A + path).status_code == 401
        assert client.get(A + path, headers=admin).status_code == 200


def test_stats_and_tables(client, make_user, admin):
    brand, c1, c2, pid = _setup(client, make_user)
    app_id = _apply(client, c1, pid, 5000).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    client.post("/api/v1/deliverables", headers=c1, json={"project_id": pid, "file_url": "https://example.com/f.mp4", "kind": "FINAL"})
    client.post(f"/api/v1/projects/{pid}/approve", headers=brand)
    s = client.get(A + "/stats", headers=admin).json()["data"]
    assert (s["total_users"], s["total_creators"], s["total_brands"]) == (4, 2, 1) and s["active_projects"] == 1 and s["gross_volume"] == []
    client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand)
    client.post(f"/api/v1/projects/{pid}/complete", headers=brand)
    s = client.get(A + "/stats", headers=admin).json()["data"]
    assert s["completed_projects"] == 1 and s["gross_volume"] == [{"currency": "INR", "amount": 5000}] and s["platform_revenue"] == [{"currency": "INR", "amount": 1000}]

    assert client.get(A + "/users?role=CREATOR", headers=admin).json()["data"]["total"] == 2
    assert client.get(A + "/users?q=b@b", headers=admin).json()["data"]["items"][0]["name"] == "Acme"
    assert client.get(A + "/users?role=NOPE", headers=admin).status_code == 422
    assert client.get(A + "/brands", headers=admin).json()["data"]["items"][0]["projects"] == 1
    assert client.get(A + "/projects?status=COMPLETED", headers=admin).json()["data"]["total"] == 1
    pay = client.get(A + "/payments", headers=admin).json()["data"]["items"][0]
    assert (pay["payer"], pay["recipient"], pay["status"]) == ("Acme", "Aisha", "RELEASED")
    det = client.get(f"{A}/payments/{pay['id']}", headers=admin).json()["data"]
    assert det["creator_receives"] == "4000 INR" and det["provider_payment_id"].startswith("mock_pay_")
    pd = client.get(f"{A}/projects/{pid}", headers=admin).json()["data"]
    assert pd["creator"] == "Aisha" and pd["payment_status"] == "RELEASED"
    assert client.get(f"{A}/projects/nope", headers=admin).status_code == 404


def test_verification_and_featuring(client, make_user, admin):
    c1, c2 = make_user("c1@c.com", "CREATOR", "Aisha"), make_user("c2@c.com", "CREATOR", "Ben")
    id1, id2 = _creator_id(client, c1), _creator_id(client, c2)
    assert client.post("/api/v1/creators/me/verification-request", headers=c1).json()["data"]["verification_requested"] is True
    assert client.post("/api/v1/creators/me/verification-request", headers=c1).json()["error"]["code"] == "ALREADY_REQUESTED"
    assert client.get(A + "/stats", headers=admin).json()["data"]["pending_verification"] == 1
    pend = client.get(A + "/creators?pending=true", headers=admin).json()["data"]
    assert [c["display_name"] for c in pend["items"]] == ["Aisha"]
    assert client.post(f"{A}/creators/{id1}/verify", json={"verified": True}, headers=c1).status_code == 403
    assert client.post(f"{A}/creators/{id1}/verify", json={"verified": True}, headers=admin).status_code == 200
    assert client.get(f"/api/v1/creators/{id1}").json()["data"]["verified"] is True
    assert "CREATOR_VERIFIED" in [n["type"] for n in client.get("/api/v1/notifications", headers=c1).json()["data"]["items"]]
    assert client.get(A + "/stats", headers=admin).json()["data"]["pending_verification"] == 0
    assert client.post("/api/v1/creators/me/verification-request", headers=c1).json()["error"]["code"] == "ALREADY_VERIFIED"

    names = lambda: [c["display_name"] for c in client.get("/api/v1/creators?sort=recommended").json()["data"]["items"]]
    assert names()[0] == "Aisha"  # verified first
    client.post(f"{A}/creators/{id2}/feature", json={"featured": True}, headers=admin)
    assert names()[0] == "Ben"  # featured beats verified
    client.post(f"{A}/creators/{id2}/feature", json={"featured": False}, headers=admin)
    assert names()[0] == "Aisha"
    assert client.post(f"{A}/creators/nope/feature", json={"featured": True}, headers=admin).status_code == 404


def test_suspend(client, make_user, admin):
    c = make_user("c@c.com", "CREATOR", "Aisha")
    uid = client.get(A + "/users?q=c@c.com", headers=admin).json()["data"]["items"][0]["id"]
    admin_id = client.get(A + "/users?role=ADMIN", headers=admin).json()["data"]["items"][0]["id"]
    assert client.post(f"{A}/users/{admin_id}/suspend", json={"suspended": True}, headers=admin).status_code == 403
    assert client.post(f"{A}/users/{uid}/suspend", json={"suspended": True}, headers=c).status_code == 403
    assert client.post(f"{A}/users/{uid}/suspend", json={"suspended": True}, headers=admin).status_code == 200
    login = client.post("/api/v1/auth/login", json={"email": "c@c.com", "password": "secret123"})
    assert login.status_code == 403 and login.json()["error"]["code"] == "USER_SUSPENDED"
    assert client.get("/api/v1/auth/me", headers=c).status_code == 403  # existing tokens stop working too
    assert client.get("/api/v1/creators").json()["data"]["total"] == 0
    assert client.get(A + "/users?active=false", headers=admin).json()["data"]["total"] == 1
    client.post(f"{A}/users/{uid}/suspend", json={"suspended": False}, headers=admin)
    assert client.get("/api/v1/creators").json()["data"]["total"] == 1


def _report(client, h, ttype, tid, reason="SPAM"):
    return client.post("/api/v1/reports", json={"target_type": ttype, "target_id": tid, "reason": reason}, headers=h)


def test_reports_and_content_removal(client, make_user, admin):
    brand, c1, c2, pid = _setup(client, make_user)
    item = client.post("/api/v1/creators/me/portfolio", headers=c1, json={"title": "Fake work", "media_url": "https://example.com/x", "media_type": "LINK"}).json()["data"]["id"]
    cid = _creator_id(client, c1)

    assert _report(client, c2, "PROJECT", "nope").status_code == 404
    assert _report(client, c2, "PROJECT", pid).status_code == 201
    assert _report(client, c2, "PROJECT", pid).json()["error"]["code"] == "ALREADY_REPORTED"
    assert _report(client, c2, "PORTFOLIO", item, "FRAUD").status_code == 201
    assert _report(client, c2, "CREATOR", cid).status_code == 201
    assert client.post("/api/v1/reports", json={"target_type": "USER", "target_id": "x", "reason": "SPAM"}, headers=c2).status_code == 422
    assert client.post("/api/v1/reports", json={"target_type": "PROJECT", "target_id": pid, "reason": "SPAM"}).status_code == 401

    reps = client.get(A + "/reports?status=OPEN", headers=admin).json()["data"]
    assert reps["total"] == 3 and client.get(A + "/stats", headers=admin).json()["data"]["open_reports"] == 3
    by = {r["target_type"]: r for r in reps["items"]}
    assert by["PROJECT"]["target"] == JOB["title"] and by["PORTFOLIO"]["target"] == "Fake work"

    resolve = lambda r, action, note=None: client.post(f"{A}/reports/{r['id']}/resolve", json={"action": action, "note": note}, headers=admin)
    assert resolve(by["CREATOR"], "REMOVE_CONTENT").status_code == 422
    assert client.post(f"{A}/reports/{by['PROJECT']['id']}/resolve", json={"action": "REMOVE_CONTENT"}, headers=c2).status_code == 403
    assert resolve(by["PROJECT"], "REMOVE_CONTENT", "Spam listing").status_code == 200
    assert client.get(f"/api/v1/projects/{pid}").json()["data"]["status"] == "CANCELLED"
    assert client.get("/api/v1/projects").json()["data"]["total"] == 0
    assert "CONTENT_REMOVED" in [n["type"] for n in client.get("/api/v1/notifications", headers=brand).json()["data"]["items"]]
    assert "REPORT_REVIEWED" in [n["type"] for n in client.get("/api/v1/notifications", headers=c2).json()["data"]["items"]]
    assert resolve(by["PROJECT"], "DISMISS").json()["error"]["code"] == "INVALID_STATE"

    assert resolve(by["PORTFOLIO"], "REMOVE_CONTENT").status_code == 200
    assert client.get(f"/api/v1/creators/{cid}/portfolio").json()["data"] == []
    assert resolve(by["CREATOR"], "DISMISS", "Looks fine").json()["data"]["status"] == "DISMISSED"
    assert client.get(A + "/reports?status=OPEN", headers=admin).json()["data"]["total"] == 0


def test_removing_a_hired_project_is_refused_and_review_removal_fixes_rating(client, make_user, admin):
    brand, c1, c2, pid = _setup(client, make_user)
    app_id = _apply(client, c1, pid).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    rep = _report(client, c2, "PROJECT", pid).json()["data"]["id"]
    assert client.post(f"{A}/reports/{rep}/resolve", json={"action": "REMOVE_CONTENT"}, headers=admin).json()["error"]["code"] == "INVALID_STATE"

    client.post("/api/v1/deliverables", headers=c1, json={"project_id": pid, "file_url": "https://example.com/f.mp4", "kind": "FINAL"})
    client.post(f"/api/v1/projects/{pid}/approve", headers=brand)
    client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand)
    client.post(f"/api/v1/projects/{pid}/complete", headers=brand)
    client.post("/api/v1/reviews", headers=brand, json={"project_id": pid, "rating": 1, "comment": "Unfair and abusive review"})
    cid = _creator_id(client, c1)
    assert client.get(f"/api/v1/creators/{cid}").json()["data"]["rating"] == 1.0
    review_id = client.get(f"/api/v1/projects/{pid}/workspace", headers=c1).json()["data"]["reviews"][0]["id"]
    rr = _report(client, c1, "REVIEW", review_id, "INAPPROPRIATE").json()["data"]["id"]
    assert client.post(f"{A}/reports/{rr}/resolve", json={"action": "REMOVE_CONTENT"}, headers=admin).status_code == 200
    me = client.get(f"/api/v1/creators/{cid}").json()["data"]
    assert (me["rating"], me["review_count"]) == (0.0, 0)


def test_categories(client, make_user, admin):
    c = make_user("c@c.com", "CREATOR", "Aisha")
    client.patch("/api/v1/creators/me", json={"skills": ["AI UGC"]}, headers=c)
    cats = client.get(A + "/categories", headers=admin).json()["data"]
    ugc = next(s for s in cats["skills"] if s["name"] == "AI UGC")
    assert ugc["usage"] == 1 and set(cats) == {"skills", "niches", "languages", "ai_tools"}
    assert client.post(A + "/categories/niches", json={"name": "Real Estate"}, headers=admin).status_code == 201
    assert client.post(A + "/categories/niches", json={"name": "real estate"}, headers=admin).json()["error"]["code"] == "CATEGORY_EXISTS"
    assert client.post(A + "/categories/nope", json={"name": "Whatever"}, headers=admin).status_code == 404
    assert "Real Estate" in [n["name"] for n in client.get("/api/v1/creators/lookups").json()["data"]["niches"]]
    assert client.delete(f"{A}/categories/skills/{ugc['id']}", headers=admin).json()["error"]["code"] == "CATEGORY_IN_USE"
    new = next(n for n in client.get(A + "/categories", headers=admin).json()["data"]["niches"] if n["name"] == "Real Estate")
    assert client.delete(f"{A}/categories/niches/{new['id']}", headers=admin).status_code == 200
    assert client.delete(f"{A}/categories/niches/{new['id']}", headers=admin).status_code == 404


def test_create_admin_script(session_factory):
    with session_factory() as db:
        assert create_admin(db, "Boss@Example.com", "longenough").role.value == "ADMIN"
        with pytest.raises(ValueError):
            create_admin(db, "boss@example.com", "longenough")
        with pytest.raises(ValueError):
            create_admin(db, "other@example.com", "short")
