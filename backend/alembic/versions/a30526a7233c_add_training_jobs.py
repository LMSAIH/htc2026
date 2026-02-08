"""add_training_jobs

Revision ID: a30526a7233c
Revises: ad6494d7b0fc
Create Date: 2026-02-07 21:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a30526a7233c"
down_revision: Union[str, None] = "ad6494d7b0fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "training_jobs",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("mission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task", sa.String(50), nullable=False),
        sa.Column("base_model", sa.String(255), nullable=False),
        sa.Column("max_epochs", sa.Integer(), nullable=False, default=10),
        sa.Column("batch_size", sa.Integer(), nullable=False, default=16),
        sa.Column("learning_rate", sa.Float(), nullable=False, default=3e-4),
        sa.Column("use_lora", sa.Boolean(), nullable=False, default=True),
        sa.Column("target_accuracy", sa.Float(), nullable=True),
        sa.Column("dataset_path", sa.String(500), nullable=True),
        sa.Column("output_model_path", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, default="queued"),
        sa.Column("epochs_completed", sa.Integer(), nullable=False, default=0),
        sa.Column("result_accuracy", sa.Float(), nullable=True),
        sa.Column("result_loss", sa.Float(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("actual_cost_usd", sa.Float(), nullable=True),
        sa.Column("notify_webhook", sa.String(500), nullable=True),
        sa.Column("vultr_instance_id", sa.String(64), nullable=True),
        sa.Column("vultr_instance_ip", sa.String(45), nullable=True),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_id"], ["ai_models.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_training_jobs_mission_id", "training_jobs", ["mission_id"])
    op.create_index("idx_training_jobs_status", "training_jobs", ["status"])
    op.create_index("idx_training_jobs_created_at", "training_jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_training_jobs_created_at", table_name="training_jobs")
    op.drop_index("idx_training_jobs_status", table_name="training_jobs")
    op.drop_index("idx_training_jobs_mission_id", table_name="training_jobs")
    op.drop_table("training_jobs")
