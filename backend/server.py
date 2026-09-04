from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db


CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; img-src 'self' data: blob: https://images.unsplash.com; "
    "font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; "
    "base-uri 'self'; form-action 'self';"
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CSP,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # TTL indexes: Mongo reaps the documents itself, so nothing lingers if a process dies.
    # expireAfterSeconds=0 means "delete once the field's timestamp is in the past".
    await db.secrets.create_index("purge_at", expireAfterSeconds=0)
    await db.wall_posts.create_index("expires_at", expireAfterSeconds=0)
    await db.receipts.create_index("expires_at", expireAfterSeconds=0)
    await db.pow_challenges.create_index("expires_at", expireAfterSeconds=0)
    await db.pow_challenges.create_index("challenge", unique=True)
    await db.threads.create_index("expires_at", expireAfterSeconds=0)
    await db.threads.create_index("last_activity_at")
    await db.replies.create_index("thread_id")
    yield
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def security_headers(request, call_next):
    """Hardens every response. Blocks injected third-party JS — the main threat to
    browser-side cryptography — and keeps the key fragment out of Referer headers."""
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/health")
async def health():
    """Uptime probe. No auth, no DB call, sub-1ms response."""
    return {"status": "ok"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

from routers.secrets import router as secrets_router
from routers.wall import router as wall_router
from routers.threads import router as threads_router

api_router.include_router(secrets_router)
api_router.include_router(wall_router)
api_router.include_router(threads_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'https://serial.sumitdwivedi.com').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
