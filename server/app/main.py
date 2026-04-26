from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prisma import Prisma

from app.core.config import get_settings
from app.core.redis import close_redis
from app.modules.account.router import router as account_router
from app.modules.social.router import router as social_router
from app.modules.social.board_router import router as board_router
from app.modules.notification.router import router as notification_router
from app.core.dependencies import db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not db.is_connected():
        await db.connect()
    yield
    if db.is_connected():
        await db.disconnect()
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(account_router, prefix=settings.API_V1_PREFIX)
app.include_router(social_router, prefix=settings.API_V1_PREFIX)
app.include_router(board_router, prefix=settings.API_V1_PREFIX)
app.include_router(notification_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
