from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import admin, ai, auth, comms, creators, files, payments, projects, users, workflow, ws
from app.utils.responses import AppError

app = FastAPI(title="AI Content Creator Marketplace", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _err(status: int, code: str, message: str, details=None):
    err = {"code": code, "message": message}
    if details:
        err["details"] = details
    return JSONResponse(status_code=status, content={"success": False, "error": err})


@app.exception_handler(AppError)
async def app_error(_: Request, exc: AppError):
    return _err(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(map(str, e["loc"][1:])), "message": e["msg"]} for e in exc.errors()]
    return _err(422, "VALIDATION_ERROR", "Invalid input", details)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    return _err(500, "INTERNAL_ERROR", "Something went wrong")


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(creators.router, prefix="/api/v1")
app.include_router(workflow.workflow, prefix="/api/v1")  # /projects/mine must come before /projects/{id}
app.include_router(projects.router, prefix="/api/v1")
for r in (workflow.applications, workflow.deliverables, workflow.revisions, comms.notifications, comms.messages, comms.reviews, payments.router, ai.router, ai.brands, admin.router, admin.reports_router, users.router, files.router, ws.router):
    app.include_router(r, prefix="/api/v1")


@app.on_event("startup")
def _seed():
    from app.database import SessionLocal
    from app.seed_lookups import seed_lookups

    with SessionLocal() as db:
        seed_lookups(db)
