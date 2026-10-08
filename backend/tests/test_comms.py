from tests.test_workflow import JOB, PROPOSAL, _apply, _setup


def _types(client, h):
    return [n["type"] for n in client.get("/api/v1/notifications", headers=h).json()["data"]["items"]]


def _hire(client, brand, c1, pid):
    app_id = _apply(client, c1, pid).json()["data"]["id"]
    assert client.post(f"/api/v1/applications/{app_id}/accept", headers=brand).status_code == 200


def _complete(client, brand, c1, pid):
    _hire(client, brand, c1, pid)
    client.post("/api/v1/deliverables", headers=c1, json={"project_id": pid, "file_url": "https://example.com/f.mp4", "kind": "FINAL"})
    assert client.post(f"/api/v1/projects/{pid}/approve", headers=brand).status_code == 200
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand).status_code == 200
    assert client.post(f"/api/v1/projects/{pid}/complete", headers=brand).status_code == 200


def test_notifications_across_the_flow(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    _apply(client, c1, pid)
    assert _types(client, brand) == ["NEW_APPLICATION"]
    _apply(client, c2, pid)
    app_id = client.get(f"/api/v1/applications/project/{pid}", headers=brand).json()["data"][0]["id"]
    # accept whichever came first in the list; the other must be told it was not selected
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    all_types = sorted(_types(client, c1) + _types(client, c2))
    assert "APPLICATION_ACCEPTED" in all_types and "APPLICATION_REJECTED" in all_types
    client.post("/api/v1/deliverables", headers=_who(client, c1, c2, brand, pid), json={"project_id": pid, "file_url": "https://example.com/d.mp4", "kind": "DRAFT"})
    assert "DELIVERABLE_UPLOADED" in _types(client, brand)


def _who(client, c1, c2, brand, pid):
    hired = client.get("/api/v1/applications/mine", headers=c1).json()["data"][0]["status"] == "ACCEPTED"
    return c1 if hired else c2


def test_new_project_notifies_matching_creators_and_read_state(client, make_user):
    c = make_user("c@c.com", "CREATOR", "Aisha")
    client.patch("/api/v1/creators/me", json={"skills": ["AI UGC"]}, headers=c)
    other = make_user("d@c.com", "CREATOR", "Ben")
    client.patch("/api/v1/creators/me", json={"skills": ["AI Video"]}, headers=other)
    brand = make_user("b@b.com", "BRAND", "Acme")
    client.post("/api/v1/projects", json=JOB, headers=brand)
    assert _types(client, c) == ["NEW_PROJECT"] and _types(client, other) == []
    assert client.get("/api/v1/notifications/unread-count", headers=c).json()["data"]["unread_count"] == 1
    nid = client.get("/api/v1/notifications", headers=c).json()["data"]["items"][0]["id"]
    assert client.post(f"/api/v1/notifications/{nid}/read", headers=other).status_code == 404  # not yours
    assert client.post(f"/api/v1/notifications/{nid}/read", headers=c).status_code == 200
    assert client.get("/api/v1/notifications/unread-count", headers=c).json()["data"]["unread_count"] == 0
    assert client.get("/api/v1/notifications").status_code == 401


def test_messaging(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    send = lambda h, text: client.post("/api/v1/messages", headers=h, json={"project_id": pid, "message": text})
    assert send(brand, "hello").json()["error"]["code"] == "NOT_HIRED"
    _hire(client, brand, c1, pid)
    assert send(c2, "let me in").status_code == 403
    assert client.get(f"/api/v1/messages/project/{pid}", headers=c2).status_code == 403
    assert send(brand, "   ").status_code == 422
    assert send(brand, "Welcome aboard").status_code == 201
    assert send(brand, "Brief is attached").status_code == 201
    assert _types(client, c1).count("NEW_MESSAGE") == 1  # one alert per conversation, not per message
    msgs = client.get(f"/api/v1/messages/project/{pid}", headers=c1).json()["data"]
    assert [m["message"] for m in msgs] == ["Welcome aboard", "Brief is attached"] and not msgs[0]["mine"]
    assert client.get("/api/v1/notifications/unread-count", headers=c1).json()["data"]["unread_count"] == 1  # only the "hired" alert remains
    assert send(c1, "Thanks, starting now").status_code == 201
    mine = client.get(f"/api/v1/messages/project/{pid}", headers=brand).json()["data"]
    assert mine[0]["read_at"] is not None and mine[2]["mine"] is False


def test_reviews_update_rating_and_enforce_rules(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    review = lambda h, rating=5: client.post("/api/v1/reviews", headers=h, json={"project_id": pid, "rating": rating, "comment": "Great to work with"})
    _hire(client, brand, c1, pid)
    assert review(brand).json()["error"]["code"] == "PROJECT_NOT_COMPLETED"
    client.post("/api/v1/deliverables", headers=c1, json={"project_id": pid, "file_url": "https://example.com/f.mp4", "kind": "FINAL"})
    client.post(f"/api/v1/projects/{pid}/approve", headers=brand)
    client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand)
    client.post(f"/api/v1/projects/{pid}/complete", headers=brand)
    assert review(c2).status_code == 403
    assert review(brand, 6).status_code == 422
    assert review(brand, 4).status_code == 201
    assert review(brand, 5).json()["error"]["code"] == "ALREADY_REVIEWED"
    assert review(c1, 5).status_code == 201
    me = client.get("/api/v1/creators/me", headers=c1).json()["data"]
    assert (me["rating"], me["review_count"]) == (4.0, 1)
    pub = client.get(f"/api/v1/reviews/creator/{me['id']}").json()["data"]
    assert pub["total"] == 1 and pub["items"][0]["reviewer_name"] == "Acme"
    ws = client.get(f"/api/v1/projects/{pid}/workspace", headers=brand).json()["data"]
    assert ws["can_review"] is False and len(ws["reviews"]) == 2 and ws["brand_rating"] == {"average": 5.0, "total": 1}
    assert {"REVIEW_RECEIVED"} <= set(_types(client, c1)) and "REVIEW_RECEIVED" in _types(client, brand)
