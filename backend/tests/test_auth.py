def test_register_login_me(client):
    body = {"email": "a@brand.com", "password": "secret123", "role": "BRAND", "name": "Acme"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 201
    assert client.post("/api/v1/auth/register", json=body).status_code == 409
    tok = client.post("/api/v1/auth/login", json={"email": "a@brand.com", "password": "secret123"})
    access = tok.json()["data"]["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.json()["data"]["role"] == "BRAND"


def test_admin_register_blocked_and_bad_login(client):
    r = client.post("/api/v1/auth/register", json={"email": "x@y.com", "password": "secret123", "role": "ADMIN", "name": "Hax"})
    assert r.status_code == 403
    r = client.post("/api/v1/auth/login", json={"email": "x@y.com", "password": "nope"})
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"
