"""Dataset schemas."""
from pydantic import BaseModel
from datetime import datetime


class DatasetCreate(BaseModel):
    name: str
    description: str = ""


class DataFileResponse(BaseModel):
    id: str
    filename: str
    size_kb: int
    type: str
    status: str
    contributor_id: str | None = None
    contributor_name: str
    uploaded_at: str
    annotations: list["AnnotationResponse"] = []

    model_config = {"from_attributes": True}


class AnnotationResponse(BaseModel):
    id: str
    annotator_id: str | None = None
    annotator_name: str
    label: str
    notes: str
    created_at: str

    model_config = {"from_attributes": True}


class DatasetResponse(BaseModel):
    id: str
    name: str
    description: str
    file_count: int
    total_size_mb: float
    accepted_types: list[str] | None = None
    sample_files: list[DataFileResponse] = []
    created_at: str

    model_config = {"from_attributes": True}


class FileUploadRequest(BaseModel):
    """A file metadata item for batch upload."""
    name: str
    size: int  # bytes
    type: str


class AnnotateFileRequest(BaseModel):
    label: str
    notes: str = ""


class ReviewFileRequest(BaseModel):
    action: str  # "approve" or "reject"
    note: str = ""
