import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def migrate():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        await conn.execute(
            text("""
            ALTER TABLE training_jobs
            ADD COLUMN IF NOT EXISTS current_epoch INTEGER,
            ADD COLUMN IF NOT EXISTS current_batch INTEGER,
            ADD COLUMN IF NOT EXISTS total_batches INTEGER,
            ADD COLUMN IF NOT EXISTS current_loss FLOAT,
            ADD COLUMN IF NOT EXISTS current_accuracy FLOAT,
            ADD COLUMN IF NOT EXISTS eta_seconds INTEGER,
            ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMP
        """)
        )
        print("Migration successful!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
