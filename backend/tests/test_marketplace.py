def _creator(client, make_user, email, name, **patch):
    h = make_user(email, "CREATOR", name)
    r = client.patch("/api/v1/creators/me", json=patch, headers=h)
    assert r.status_code == 200, r.text
    return h


def test_creator_profile_and_search(client, make_user):
    _creator(client, make_user, "a@c.com", "Aisha Verma", starting_price=3000, delivery_days=3,
             niches=["Beauty"], languages=["Hindi", "English"], skills=["AI UGC"], ai_tools=["HeyGen"], bio="Skincare UGC")
    _creator(client, make_user, "b@c.com", "Ben Cole", starting_price=9000, delivery_days=7,
             niches=["SaaS"], languages=["English"], skills=["AI Video"])

    def names(qs):
        r = client.get(f"/api/v1/creators?{qs}").json()["data"]
        return sorted(i["display_name"] for i in r["items"])

    assert names("") == ["Aisha Verma", "Ben Cole"]
    assert names("niche=Beauty") == ["Aisha Verma"]
    assert names("language=Hindi") == ["Aisha Verma"]
    assert names("max_price=5000") == ["Aisha Verma"]
    assert names("delivery_days=3") == ["Aisha Verma"]
    assert names("ai_tool=HeyGen") == ["Aisha Verma"]
    assert names("q=skincare") == ["Aisha Verma"]
    assert names("sort=price") == ["Aisha Verma", "Ben Cole"]
    assert client.get("/api/v1/creators?page_size=1").json()["data"]["total"] == 2


def test_unknown_tag_and_role_guard(client, make_user):
    h = make_user("a@c.com", "CREATOR", "Aisha")
    assert client.patch("/api/v1/creators/me", json={"niches": ["Nope"]}, headers=h).status_code == 422
    brand = make_user("b@b.com", "BRAND", "Acme")
    assert client.patch("/api/v1/creators/me", json={"bio": "x"}, headers=brand).status_code == 403
    assert client.patch("/api/v1/creators/me", json={"bio": "x"}).status_code == 401


def test_portfolio_ownership(client, make_user):
    a = make_user("a@c.com", "CREATOR", "Aisha")
    b = make_user("b@c.com", "CREATOR", "Ben")
    item = {"title": "Serum reel", "media_url": "https://example.com/v.mp4", "media_type": "VIDEO"}
    r = client.post("/api/v1/creators/me/portfolio", json=item, headers=a)
    assert r.status_code == 201
    pid = r.json()["data"]["id"]
    assert client.delete(f"/api/v1/creators/me/portfolio/{pid}", headers=b).status_code == 404
    assert client.delete(f"/api/v1/creators/me/portfolio/{pid}", headers=a).status_code == 200


def test_jobs_flow(client, make_user):
    brand = make_user("b@b.com", "BRAND", "Acme")
    creator = make_user("c@c.com", "CREATOR", "Aisha")
    job = {"title": "30s skincare Reel", "description": "Instagram reel for our serum", "category": "AI UGC",
           "content_type": "Reel", "budget": 5000, "language": "English"}
    assert client.post("/api/v1/projects", json=job, headers=creator).status_code == 403
    r = client.post("/api/v1/projects", json=job, headers=brand)
    assert r.status_code == 201
    pid = r.json()["data"]["id"]
    listing = client.get("/api/v1/projects?category=AI UGC").json()["data"]
    assert listing["total"] == 1
    assert client.get(f"/api/v1/projects/{pid}").json()["data"]["status"] == "OPEN"
    assert client.get("/api/v1/projects/missing").json()["error"]["code"] == "PROJECT_NOT_FOUND"
    assert client.post("/api/v1/projects", json={**job, "budget": -1}, headers=brand).status_code == 422
