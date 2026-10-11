import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.test_application import app as application_fixture
from tests.test_application import register


def test_websocket_rejects_unconfigured_origin(app):
    client = TestClient(app)
    register(client)

    with client.websocket_connect(
        "/api/ws/session", headers={"Origin": "https://evil.invalid"}
    ) as websocket:
        with pytest.raises(WebSocketDisconnect) as closed:
            websocket.receive_text()

    assert closed.value.code == 4403


def test_websocket_keeps_allowed_origin_and_protocol_compatible(app):
    client = TestClient(app)
    register(client)

    with client.websocket_connect(
        "/api/ws/session", headers={"Origin": "http://testserver"}
    ) as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "session_status"
        assert connected["data"]["status"] == "connected"

        websocket.send_json({"type": "ping"})
        pong = websocket.receive_json()
        assert pong["type"] == "pong"
        assert isinstance(pong["timestamp"], int)
