import base64
from datetime import timedelta

import boto3
import pytest
from moto import mock_aws

from app.config import settings
from app.services import upload_service
from app.utils.security import create_token
from tests.test_workflow import JOB, _apply, _setup

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64
PDF = b"%PDF-1.4\n%test\n"


@pytest.fixture(autouse=True)
def local_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setattr(settings, "S3_BUCKET", "")


def up(client, h, purpose, name="a.png", data=PNG, ctype="image/png", project_id=None):
    form = {"purpose": purpose, **({"project_id": project_id} if project_id else {})}
    return client.post("/api/v1/files", data=form, files={"file": (name, data, ctype)}, headers=h)


def test_public_upload_is_served_without_login(client, make_user):
    creator, brand = make_user("c@c.com", "CREATOR", "Aisha"), make_user("b@b.com", "BRAND", "Acme")
    r = up(client, creator, "AVATAR")
    assert r.status_code == 201
    f = r.json()["data"]
    assert f["url"].startswith("http://testserver/api/v1/files/") and f["content_type"] == "image/png" and f["size"] == len(PNG)
    got = client.get(f["url"].replace("http://testserver", ""))
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["content-type"] == "image/png" and got.headers["x-content-type-options"] == "nosniff"
    assert client.patch("/api/v1/creators/me", json={"avatar": f["url"]}, headers=creator).json()["data"]["avatar"] == f["url"]
    assert up(client, brand, "AVATAR").status_code == 403
    assert up(client, brand, "LOGO").status_code == 201
    assert up(client, creator, "LOGO").status_code == 403
    assert client.post("/api/v1/files", data={"purpose": "AVATAR"}, files={"file": ("a.png", PNG, "image/png")}).status_code == 401


def test_validation(client, make_user, monkeypatch):
    c = make_user("c@c.com", "CREATOR", "Aisha")
    bad = lambda **kw: up(client, c, **kw)
    assert bad(purpose="AVATAR", data=b"this is not a png at all").json()["error"]["code"] == "INVALID_FILE_TYPE"  # contents do not match the extension
    assert bad(purpose="AVATAR", name="x.svg", data=b"<svg onload=alert(1)>").status_code == 422
    assert bad(purpose="AVATAR", name="x.exe", data=b"MZ" + b"0" * 20).status_code == 422
    assert bad(purpose="AVATAR", name="noextension", data=PNG).status_code == 422
    assert bad(purpose="AVATAR", name="../../evil.png").json()["data"]["filename"] == "evil.png"  # path stripped
    assert bad(purpose="AVATAR", name="v.mp4", data=MP4).status_code == 422  # video not allowed for avatars
    assert bad(purpose="PORTFOLIO", name="v.mp4", data=MP4).status_code == 201
    assert bad(purpose="AVATAR", data=b"").json()["error"]["code"] == "EMPTY_FILE"
    assert bad(purpose="NOPE").json()["error"]["code"] == "UNKNOWN_PURPOSE"
    monkeypatch.setitem(upload_service.PURPOSES["AVATAR"], "max_mb", 0.00001)
    assert bad(purpose="AVATAR").status_code == 413


def _hired(client, make_user):
    brand, c1, c2, pid = _setup(client, make_user)
    app_id = _apply(client, c1, pid).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/accept", headers=brand)
    return brand, c1, c2, pid


def test_private_deliverable_needs_a_signed_link(client, make_user):
    brand, c1, c2, pid = _hired(client, make_user)
    outsider = make_user("o@c.com", "CREATOR", "Outsider")
    assert up(client, c1, "DELIVERABLE", "d.mp4", MP4, project_id=None).status_code == 422
    assert up(client, c2, "DELIVERABLE", "d.mp4", MP4, project_id=pid).status_code == 403  # not hired
    assert up(client, brand, "DELIVERABLE", "d.mp4", MP4, project_id=pid).status_code == 403
    f = up(client, c1, "DELIVERABLE", "draft.mp4", MP4, project_id=pid).json()["data"]
    assert f["url"] is None  # no permanent URL for private files

    content = f"/api/v1/files/{f['id']}/content"
    assert client.get(content).status_code == 401
    assert client.get(f"/api/v1/files/{f['id']}/link").status_code == 401
    assert client.get(f"/api/v1/files/{f['id']}/link", headers=outsider).status_code == 403
    link = client.get(f"/api/v1/files/{f['id']}/link", headers=brand).json()["data"]
    assert link["expires_in"] == 300 and "token=" in link["url"]
    got = client.get(link["url"].replace("http://testserver", ""))
    assert got.status_code == 200 and got.content == MP4 and got.headers["cache-control"] == "private, no-store"
    other = up(client, c1, "DELIVERABLE", "other.mp4", MP4, project_id=pid).json()["data"]
    assert client.get(f"/api/v1/files/{other['id']}/content?token={link['url'].split('token=')[1]}").status_code == 401  # token is per file
    expired = create_token(f["id"], "file", timedelta(seconds=-5))
    assert client.get(f"{content}?token={expired}").status_code == 401
    assert client.get(f"{content}?token={create_token(f['id'], 'access', timedelta(minutes=5))}").status_code == 401  # wrong token type

    body = {"project_id": pid, "kind": "DRAFT"}
    d = lambda **kw: client.post("/api/v1/deliverables", json={**body, **kw}, headers=c1)
    assert d().status_code == 422 and d(file_url="https://x.com/a.mp4", file_id=f["id"]).status_code == 422
    assert d(file_id=up(client, c1, "ATTACHMENT", "x.pdf", PDF, "application/pdf", project_id=pid).json()["data"]["id"]).status_code == 422  # wrong purpose
    assert d(file_id=f["id"]).status_code == 201
    ws = client.get(f"/api/v1/projects/{pid}/workspace", headers=brand).json()["data"]
    assert ws["deliverables"][0]["file"]["filename"] == "draft.mp4" and ws["deliverables"][0]["file_url"] == ""


def test_project_assets_flow(client, make_user):
    brand, other_brand = make_user("b@b.com", "BRAND", "Acme"), make_user("o@b.com", "BRAND", "Other")
    creator = make_user("c@c.com", "CREATOR", "Aisha")
    logo = up(client, brand, "ASSET", "logo.png").json()["data"]
    guide = up(client, brand, "ASSET", "guide.pdf", PDF, "application/pdf").json()["data"]
    assert up(client, creator, "ASSET").status_code == 403
    stolen = {**JOB, "assets": [{"file_id": logo["id"], "file_type": "LOGO"}]}
    assert client.post("/api/v1/projects", json=stolen, headers=other_brand).json()["error"]["code"] == "INVALID_FILE"
    job = {**JOB, "assets": [{"file_id": logo["id"], "file_type": "LOGO"}, {"file_id": guide["id"], "file_type": "GUIDELINES"}],
           "video_duration": 30, "style": "Warm, handheld", "deliverables": "1 reel, 3 hooks", "revisions": 3}
    p = client.post("/api/v1/projects", json=job, headers=brand)
    assert p.status_code == 201 and p.json()["data"]["revisions"] == 3
    assert client.post("/api/v1/projects", json={**JOB, "assets": [{"file_id": logo["id"], "file_type": "LOGO"}]}, headers=brand).status_code == 422  # already attached
    pid = p.json()["data"]["id"]
    d = client.get(f"/api/v1/projects/{pid}").json()["data"]
    assert (d["video_duration"], d["style"], d["deliverables"]) == (30, "Warm, handheld", "1 reel, 3 hooks")
    assert [(a["file_type"], a["file"]["filename"]) for a in d["assets"]] == [("LOGO", "logo.png"), ("GUIDELINES", "guide.pdf")]
    assert all(a["file"]["url"] is None for a in d["assets"])
    assert client.get(f"/api/v1/files/{logo['id']}/link", headers=creator).status_code == 200
    assert client.get(f"/api/v1/files/{logo['id']}/link", headers=other_brand).status_code == 403
    assert client.post("/api/v1/projects", json=JOB, headers=brand).json()["data"]["revisions"] == 2  # default


def test_chat_attachments(client, make_user):
    brand, c1, c2, pid = _hired(client, make_user)
    assert up(client, c2, "ATTACHMENT", "x.pdf", PDF, "application/pdf", project_id=pid).status_code == 403
    f = up(client, c1, "ATTACHMENT", "ref.pdf", PDF, "application/pdf", project_id=pid).json()["data"]
    sent = client.post("/api/v1/messages", json={"project_id": pid, "message": "Reference attached", "attachment_file_id": f["id"]}, headers=c1)
    assert sent.status_code == 201
    msgs = client.get(f"/api/v1/messages/project/{pid}", headers=brand).json()["data"]
    assert msgs[0]["attachment_file"]["filename"] == "ref.pdf"
    assert client.get(f"/api/v1/files/{f['id']}/link", headers=brand).status_code == 200
    assert client.post("/api/v1/messages", json={"project_id": pid, "message": "Mine now", "attachment_file_id": f["id"]}, headers=brand).status_code == 422  # not the uploader


@mock_aws
def test_s3_storage(client, make_user, monkeypatch):
    boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="creatorly-test")
    for k, v in (("S3_BUCKET", "creatorly-test"), ("S3_ACCESS_KEY", "test"), ("S3_SECRET_KEY", "test"), ("S3_ENDPOINT", ""), ("S3_REGION", "us-east-1")):
        monkeypatch.setattr(settings, k, v)
    c = make_user("c@c.com", "CREATOR", "Aisha")
    f = up(client, c, "AVATAR").json()["data"]
    keys = [o["Key"] for o in boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="creatorly-test")["Contents"]]
    assert len(keys) == 1 and keys[0].startswith("avatar/") and keys[0].endswith(".png")
    got = client.get(f["url"].replace("http://testserver", ""))
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"


def test_websocket_chat(client, make_user):
    brand, c1, c2, pid = _hired(client, make_user)
    tok = lambda h: h["Authorization"].split()[1]
    url = lambda h: f"/api/v1/messages/ws/{pid}?token={tok(h)}"
    for bad in (url(c2), f"/api/v1/messages/ws/{pid}?token=garbage", f"/api/v1/messages/ws/{pid}"):
        with pytest.raises(Exception):
            with client.websocket_connect(bad):
                pass
    with client.websocket_connect(url(c1)) as ws:
        assert client.post("/api/v1/messages", json={"project_id": pid, "message": "Hello there"}, headers=brand).status_code == 201
        event = ws.receive_json()
        assert event["type"] == "message" and event["id"]
        client.get(f"/api/v1/messages/project/{pid}", headers=c1)  # creator reads it, brand's side should hear "read"
    with client.websocket_connect(url(brand)) as ws2:
        client.get(f"/api/v1/messages/project/{pid}", headers=c1)
        client.post("/api/v1/messages", json={"project_id": pid, "message": "Reply"}, headers=c1)
        assert ws2.receive_json()["type"] == "message"
