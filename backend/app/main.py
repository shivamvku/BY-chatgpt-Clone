import json
import logging
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse, Response
from starlette.types import Scope

from app.api import admin, auth, chat, files, subscriptions, websocket
from app.api.health import router
from app.core.config import get_settings


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or "." in path.rsplit("/", 1)[-1]:
                raise
            return await super().get_response("index.html", scope)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="YounderChat API",
        version="0.1.0",
        docs_url="/api/docs" if settings.app_env == "development" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.app_env == "development" else None,
    )
    app.include_router(router, prefix="/api")
    for module in (auth, admin, chat, files, subscriptions, websocket):
        app.include_router(module.router, prefix="/api")

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exception):
        return JSONResponse(
            {"detail": "Database temporarily unavailable; try again"}, status_code=503
        )

    @app.middleware("http")
    async def security_headers(request, call_next):
        started = time.monotonic()
        request_id = str(uuid.uuid4())
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 3 * 1024 * 1024:
                    return JSONResponse({"detail": "Request exceeded size limit"}, status_code=413)
            request._body = bytes(body)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        route = request.scope.get("route")
        logging.getLogger("uvicorn.error").info(
            json.dumps(
                {
                    "request_id": request_id,
                    "method": request.method,
                    "route": getattr(route, "path", "frontend"),
                    "status": response.status_code,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                }
            )
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; connect-src 'self'; font-src 'self'; "
                "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
            )
        return response

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def unknown_api(path: str) -> None:
        raise HTTPException(status_code=404, detail="API endpoint not found")

    if settings.serve_frontend:
        app.mount("/", SPAStaticFiles(directory=settings.frontend_directory, html=True))
    return app


app = create_app()
