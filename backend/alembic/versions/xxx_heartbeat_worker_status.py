"""Add heartbeat and worker status columns to training_jobs

Revision ID: xxx_heartbeat_worker_status
Revises: abc123
Create Date: 2026-02-08

"""

from alembic import op
import sqlalchemy as sa

revision = "xxx_heartbeat_worker_status"
down_revision = "abc123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "training_jobs", sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "training_jobs", sa.Column("worker_status", sa.String(20), nullable=True)
    )
    op.add_column("training_jobs", sa.Column("gpu_temp_c", sa.Float(), nullable=True))
    op.add_column(
        "training_jobs", sa.Column("gpu_memory_used_gb", sa.Float(), nullable=True)
    )

    op.create_table(
        "training_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("training_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("level", sa.String(10), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("epoch", sa.Integer(), nullable=True),
        sa.Column("batch", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("idx_training_logs_job_id", "training_logs", ["job_id"])
    op.create_index("idx_training_logs_timestamp", "training_logs", ["timestamp"])


def downgrade() -> None:
    op.drop_index("idx_training_logs_timestamp", table_name="training_logs")
    op.drop_index("idx_training_logs_job_id", table_name="training_logs")
    op.drop_table("training_logs")
    op.drop_column("training_jobs", "gpu_memory_used_gb")
    op.drop_column("training_jobs", "gpu_temp_c")
    op.drop_column("training_jobs", "worker_status")
    op.drop_column("training_jobs", "last_heartbeat_at")
