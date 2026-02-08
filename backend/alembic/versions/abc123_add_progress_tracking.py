"""Add progress tracking columns

Revision ID: abc123
Revises: a30526a7233c
Create Date: 2026-02-08

"""

from alembic import op
import sqlalchemy as sa

revision = "abc123"
down_revision = "a30526a7233c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "training_jobs", sa.Column("current_epoch", sa.Integer(), nullable=True)
    )
    op.add_column(
        "training_jobs", sa.Column("current_batch", sa.Integer(), nullable=True)
    )
    op.add_column(
        "training_jobs", sa.Column("total_batches", sa.Integer(), nullable=True)
    )
    op.add_column("training_jobs", sa.Column("current_loss", sa.Float(), nullable=True))
    op.add_column(
        "training_jobs", sa.Column("current_accuracy", sa.Float(), nullable=True)
    )
    op.add_column(
        "training_jobs", sa.Column("eta_seconds", sa.Integer(), nullable=True)
    )
    op.add_column(
        "training_jobs", sa.Column("last_progress_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("training_jobs", "last_progress_at")
    op.drop_column("training_jobs", "eta_seconds")
    op.drop_column("training_jobs", "current_accuracy")
    op.drop_column("training_jobs", "current_loss")
    op.drop_column("training_jobs", "total_batches")
    op.drop_column("training_jobs", "current_batch")
    op.drop_column("training_jobs", "current_epoch")
