#!/usr/bin/env python3
"""Database migration script for heartbeat and worker status columns."""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings


async def migrate():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        # Add columns to training_jobs
        await conn.execute(
            text("""
            ALTER TABLE training_jobs
            ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP
        """)
        )
        await conn.execute(
            text("""
            ALTER TABLE training_jobs
            ADD COLUMN IF NOT EXISTS worker_status VARCHAR(20)
        """)
        )
        await conn.execute(
            text("""
            ALTER TABLE training_jobs
            ADD COLUMN IF NOT EXISTS gpu_temp_c FLOAT
        """)
        )
        await conn.execute(
            text("""
            ALTER TABLE training_jobs
            ADD COLUMN IF NOT EXISTS gpu_memory_used_gb FLOAT
        """)
        )

        # Create training_logs table
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS training_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL REFERENCES training_jobs(id) ON DELETE CASCADE,
                level VARCHAR(10) NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                epoch INTEGER,
                batch INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        )

        # Create indexes
        await conn.execute(
            text("""
            CREATE INDEX IF NOT EXISTS idx_training_logs_job_id ON training_logs(job_id)
        """)
        )
        await conn.execute(
            text("""
            CREATE INDEX IF NOT EXISTS idx_training_logs_timestamp ON training_logs(timestamp)
        """)
        )

    await engine.dispose()
    print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
