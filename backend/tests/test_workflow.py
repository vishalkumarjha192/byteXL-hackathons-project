JOB = {"title": "30s skincare Reel", "description": "Instagram reel for our serum launch", "category": "AI UGC",
       "content_type": "Reel", "budget": 5000}
PROPOSAL = "I make skincare UGC with HeyGen and can deliver in three days."


def _setup(client, make_user):
    brand = make_user("b@b.com", "BRAND", "Acme")
    c1 = make_user("c1@c.com", "CREATOR", "Aisha")
    c2 = make_user("c2@c.com", "CREATOR", "Ben")
    pid = client.post("/api/v1/projects", json=JOB, headers=brand).json()["data"]["id"]
    return brand, c1, c2, pid


def _apply(client, h, pid, price=5000):
    return client.post("/api/v1/applications", headers=h,
                       json={"project_id": pid, "proposal": PROPOSAL, "proposed_price": price, "delivery_days": 3})


def test_full_flow(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    r = _apply(client, c1, pid)
    assert r.status_code == 201
    assert _apply(client, c1, pid).json()["error"]["code"] == "ALREADY_APPLIED"
    _apply(client, c2, pid, 4000)

    apps = client.get(f"/api/v1/applications/project/{pid}", headers=brand).json()["data"]
    assert len(apps) == 2
    aisha = next(a for a in apps if a["creator"]["display_name"] == "Aisha")
    assert client.get(f"/api/v1/applications/project/{pid}", headers=c1).status_code == 403

    acc = client.post(f"/api/v1/applications/{aisha['id']}/accept", headers=brand)
    assert acc.status_code == 200
    ws = client.get(f"/api/v1/projects/{pid}/workspace", headers=brand).json()["data"]
    assert ws["project"]["status"] == "IN_PROGRESS"
    assert (ws["contract"]["agreed_price"], ws["contract"]["platform_fee"], ws["contract"]["creator_amount"]) == (5000, 1000, 4000)
    mine = client.get("/api/v1/applications/mine", headers=c2).json()["data"]
    assert mine[0]["status"] == "REJECTED"
    assert _apply(client, make_user("c3@c.com", "CREATOR", "Cy"), pid).json()["error"]["code"] == "PROJECT_CLOSED"
    assert client.get(f"/api/v1/projects/{pid}/workspace", headers=c2).status_code == 403

    d = {"project_id": pid, "file_url": "https://example.com/draft.mp4", "kind": "DRAFT"}
    assert client.post("/api/v1/deliverables", json=d, headers=c2).status_code == 403
    assert client.post("/api/v1/deliverables", json=d, headers=c1).status_code == 201
    assert client.post("/api/v1/revisions", json={"project_id": pid, "description": "Shorter hook please"}, headers=brand).status_code == 201
    assert client.get(f"/api/v1/projects/{pid}/workspace", headers=c1).json()["data"]["project"]["status"] == "REVISION_REQUESTED"
    assert client.post(f"/api/v1/projects/{pid}/approve", headers=brand).json()["error"]["code"] == "INVALID_STATE"

    final = {**d, "kind": "FINAL", "file_url": "https://example.com/final.mp4"}
    assert client.post("/api/v1/deliverables", json=final, headers=c1).json()["data"]["version"] == 2
    ws = client.get(f"/api/v1/projects/{pid}/workspace", headers=c1).json()["data"]
    assert ws["project"]["status"] == "FINAL_SUBMITTED" and ws["revisions"][0]["status"] == "RESOLVED"

    assert client.post(f"/api/v1/projects/{pid}/approve", headers=brand).json()["data"]["status"] == "APPROVED"
    assert client.post(f"/api/v1/payments/project/{pid}/fund", headers=brand).status_code == 200
    assert client.post(f"/api/v1/projects/{pid}/complete", headers=brand).json()["data"]["status"] == "COMPLETED"
    me = client.get("/api/v1/creators/me", headers=c1).json()["data"]
    assert me["completed_projects"] == 1
    assert client.get("/api/v1/projects/mine", headers=c1).json()["data"]["items"][0]["status"] == "COMPLETED"


def test_reject_withdraw_cancel_and_ownership(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    other_brand = make_user("o@b.com", "BRAND", "Other")
    a1 = _apply(client, c1, pid).json()["data"]["id"]
    a2 = _apply(client, c2, pid).json()["data"]["id"]
    assert client.post(f"/api/v1/applications/{a1}/accept", headers=other_brand).status_code == 403
    assert client.post(f"/api/v1/applications/{a1}/reject", headers=brand).status_code == 200
    assert client.post(f"/api/v1/applications/{a1}/reject", headers=brand).status_code == 409
    assert client.post(f"/api/v1/applications/{a2}/withdraw", headers=c2).status_code == 200
    assert client.post(f"/api/v1/applications/{a2}/withdraw", headers=c1).status_code == 404
    brand_list = client.get("/api/v1/projects/mine", headers=brand).json()["data"]
    assert brand_list["role"] == "BRAND" and brand_list["items"][0]["pending_applications"] == 0
    assert client.post(f"/api/v1/projects/{pid}/cancel", headers=other_brand).status_code == 403
    assert client.post(f"/api/v1/projects/{pid}/cancel", headers=brand).json()["data"]["status"] == "CANCELLED"
    assert client.post(f"/api/v1/projects/{pid}/cancel", headers=brand).status_code == 409
    assert _apply(client, c1, pid).status_code == 409
