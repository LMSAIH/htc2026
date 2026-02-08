#!/usr/bin/env python3
"""Create Contribution DB records for CIFAR-10 test images uploaded to S3."""

import asyncio
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+asyncpg://dataforall_app:j%5B3C%5D%3Dgw%24edY%40BaP@vultr-prod-58b1207c-58d7-4d7a-886d-0d0016057267-vultr-prod-2a99.vultrdb.com:16751/dataforall"
MISSION_ID = "fb3c90da-9404-4cf4-957f-7a82ac266c96"

CONTRIBUTION_TABLE = """
CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id),
    filename VARCHAR(512) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    file_size BIGINT DEFAULT 0,
    content_type VARCHAR(256) DEFAULT 'application/octet-stream',
    contributor_name VARCHAR(256),
    status VARCHAR(32) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)
"""


def create_contributions():
    """Insert 20 Contribution records for CIFAR-10 images."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    mission_uuid = uuid.UUID(MISSION_ID)
    now = datetime.utcnow()

    inserted = 0
    for i in range(20):
        filename = f"img_{i}.jpg"
        s3_key = f"missions/{MISSION_ID}/contributions/{filename}"

        # Check if already exists
        result = session.execute(
            text("SELECT id FROM contributions WHERE s3_key = :s3_key"),
            {"s3_key": s3_key},
        )
        if result.fetchone():
            print(f"  Skipping (exists): {filename}")
            continue

        # Insert record
        session.execute(
            text("""
                INSERT INTO contributions
                (id, mission_id, filename, s3_key, file_size, content_type, contributor_name, status, created_at, updated_at)
                VALUES (gen_random_uuid(), :mission_id, :filename, :s3_key, :file_size, :content_type, :contributor_name, :status, :created_at, :updated_at)
            """),
            {
                "mission_id": str(mission_uuid),
                "filename": filename,
                "s3_key": s3_key,
                "file_size": 0,
                "content_type": "image/jpeg",
                "contributor_name": "cifar10-test-upload",
                "status": "approved",
                "created_at": now,
                "updated_at": now,
            },
        )
        inserted += 1
        print(f"  Inserted: {filename}")

    session.commit()
    session.close()

    print(f"\n{'=' * 60}")
    print(f"Created {inserted} new Contribution records")
    print(f"{'=' * 60}")


def verify_contributions():
    """Verify contributions were created."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    result = session.execute(
        text("""
            SELECT COUNT(*) FROM contributions
            WHERE mission_id = :mission_id AND status = 'approved'
        """),
        {"mission_id": str(uuid.UUID(MISSION_ID))},
    )
    count = result.fetchone()[0]

    result2 = session.execute(
        text(
            "SELECT filename, s3_key FROM contributions WHERE mission_id = :mission_id ORDER BY filename"
        ),
        {"mission_id": str(uuid.UUID(MISSION_ID))},
    )
    files = result2.fetchall()

    session.close()

    print(f"\nApproved contributions for mission {MISSION_ID}: {count}")
    print("\nSample files:")
    for filename, s3_key in files[:5]:
        print(f"  - {filename}: {s3_key}")
    if len(files) > 5:
        print(f"  ... and {len(files) - 5} more")

    return count


if __name__ == "__main__":
    print("Creating Contribution records for CIFAR-10 test images...")
    print(f"Mission ID: {MISSION_ID}")
    print()

    create_contributions()
    count = verify_contributions()

    print(f"\n{'=' * 60}")
    if count >= 20:
        print("SUCCESS: Ready for real training!")
    else:
        print(f"Note: Only {count} contributions found (expected 20)")
    print(f"{'=' * 60}")
