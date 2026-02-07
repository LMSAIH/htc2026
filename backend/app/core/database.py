import ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator

from app.core.config import get_settings

settings = get_settings()

# Build connect_args with SSL for managed Postgres
# Use ssl="require" to encrypt without cert verification — the managed DB
# is accessed via IP-whitelisted VKE nodes on Vultr's network.
connect_args: dict = {}
if settings.APP_ENV == "production" or settings.DB_CA_CERT_PATH:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
