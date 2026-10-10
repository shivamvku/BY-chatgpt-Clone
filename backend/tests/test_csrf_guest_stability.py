from fastapi.testclient import TestClient

from tests.test_application import app as application_fixture

app = application_fixture


def test_anonymous_session_bootstrap_keeps_csrf_token_stable(app):
    client = TestClient(app)

    first = client.get("/api/auth/session")
    assert first.status_code == 200
    first_csrf = first.json()["csrf"]

    # A second tab/bootstrap request must not rotate the cookie out from
    # underneath the token already held by the first tab.
    second = client.get("/api/auth/session")
    assert second.status_code == 200
    assert second.json()["csrf"] == first_csrf

    client.headers.update(
        {"Origin": "http://testserver", "X-CSRF-Token": first_csrf}
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "missing@example.com", "password": "wrong-password"},
    )
    # Auth should reach credential validation, not fail CSRF validation.
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
