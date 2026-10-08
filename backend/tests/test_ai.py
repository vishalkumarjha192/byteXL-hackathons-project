import httpx
import pytest

from app.config import settings
from app.services import ai_providers
from tests.test_workflow import JOB, _apply, _setup

PROMPT = "Create a 30-second skincare Instagram Reel."


def _brief(client, h, prompt=PROMPT):
    return client.post("/api/v1/ai/brief", json={"prompt": prompt}, headers=h)


def test_brief_template(client, make_user):
    brand, creator = make_user("b@b.com", "BRAND", "Acme"), make_user("c@c.com", "CREATOR", "Aisha")
    assert _brief(client, creator).status_code == 403
    assert _brief(client, brand, "short").status_code == 422
    b = _brief(client, brand).json()["data"]
    assert b["source"] == "template" and b["hook"] and b["cta"] and len(b["scenes"]) == 4
    assert b["suggested"]["platform"] == "Instagram" and "30-second" in b["deliverables"][0] and "skincare" in b["title"].lower()
    t = _brief(client, brand, "Make a 45 second TikTok about our new running shoes").json()["data"]
    assert t["suggested"]["platform"] == "TikTok" and "45-second" in t["deliverables"][0]


def test_brief_uses_ai_when_configured_and_falls_back(client, make_user, monkeypatch):
    brand = make_user("b@b.com", "BRAND", "Acme")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")
    ai_json = ('{"title":"T","hook":"H","script":"S","scenes":[{"time":"0-3s","visual":"v","voiceover":"o"}],"cta":"C",'
               '"deliverables":["d"],"suggested":{"category":"Not A Category","content_type":"Reel","platform":"Mars","language":"English"}}')

    class Ok:
        def raise_for_status(self): pass
        def json(self): return {"content": [{"type": "text", "text": "```json\n" + ai_json + "\n```"}]}

    monkeypatch.setattr(ai_providers.httpx, "post", lambda *a, **k: Ok())
    b = _brief(client, brand).json()["data"]
    assert b["source"] == "ai" and b["hook"] == "H" and b["suggested"]["category"] == "AI UGC" and b["suggested"]["platform"] == "Instagram"

    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(ai_providers.httpx, "post", boom)
    assert _brief(client, brand).json()["data"]["source"] == "template"


def test_brief_rate_limit(client, make_user):
    brand = make_user("b@b.com", "BRAND", "Acme")
    codes = [_brief(client, brand).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429
    assert _brief(client, brand).json()["error"]["code"] == "RATE_LIMITED"


def _creator(client, make_user, email, name, **patch):
    h = make_user(email, "CREATOR", name)
    assert client.patch("/api/v1/creators/me", json=patch, headers=h).status_code == 200
    return h


def test_matching_ranks_best_fit_first(client, make_user):
    brand = make_user("b@b.com", "BRAND", "Acme")
    assert client.patch("/api/v1/brands/me", json={"industry": "Beauty"}, headers=brand).status_code == 200
    assert client.patch("/api/v1/brands/me", json={"industry": "Plumbing"}, headers=brand).status_code == 422
    _creator(client, make_user, "a@c.com", "Aisha Good", skills=["AI UGC"], niches=["Beauty"], languages=["English"], starting_price=3000, delivery_days=3)
    _creator(client, make_user, "z@c.com", "Zed Far", skills=["AI Video"], niches=["SaaS"], languages=["French"], starting_price=20000, delivery_days=7)
    pid = client.post("/api/v1/projects", json={**JOB, "language": "English"}, headers=brand).json()["data"]["id"]
    res = client.get(f"/api/v1/ai/match/{pid}", headers=brand).json()["data"]
    assert [r["display_name"] for r in res] == ["Aisha Good", "Zed Far"]
    assert 0 <= res[1]["match_score"] < res[0]["match_score"] <= 100 and res[0]["match_score"] >= 70
    assert {"Offers AI UGC", "Speaks English", "Works with Beauty brands"} <= set(res[0]["reasons"])
    assert "Starting price is above the budget" in res[1]["warnings"]
    other = make_user("o@b.com", "BRAND", "Other")
    assert client.get(f"/api/v1/ai/match/{pid}", headers=other).status_code == 403
    assert client.get("/api/v1/ai/match/nope", headers=brand).status_code == 404
    assert client.get(f"/api/v1/ai/match/{pid}", headers=_creator(client, make_user, "q@c.com", "Quinn")).status_code == 403


def test_creator_job_recommendations(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    client.patch("/api/v1/creators/me", json={"skills": ["AI UGC"], "languages": ["English"]}, headers=c1)
    rec = client.get("/api/v1/ai/recommendations/projects", headers=c1).json()["data"]
    assert [r["id"] for r in rec] == [pid] and rec[0]["match_score"] > 0 and "Offers AI UGC" in rec[0]["reasons"]
    _apply(client, c1, pid)
    assert client.get("/api/v1/ai/recommendations/projects", headers=c1).json()["data"] == []
    assert client.get("/api/v1/ai/recommendations/projects", headers=brand).status_code == 403


def test_strategy_is_pluggable(monkeypatch):
    from app.services import matching
    monkeypatch.setattr(settings, "MATCHING_STRATEGY", "llm")
    with pytest.raises(RuntimeError):
        matching.get_strategy()
