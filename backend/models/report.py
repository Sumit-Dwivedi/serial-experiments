"""Abuse reports. No identity is ever attached — only the reported id and a reason."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

TargetType = Literal["secret", "wall_post", "thread", "reply"]
ReportReason = Literal["illegal", "harassment", "spam", "other"]


class ReportCreate(BaseModel):
    target_type: TargetType
    target_id: str = Field(min_length=4, max_length=200)
    reason: ReportReason = "other"
    note: str = Field(default="", max_length=2000)


class Report(BaseModel):
    id: str
    target_type: TargetType
    target_id: str
    reason: ReportReason
    note: str
    created_at: datetime
    status: Literal["pending", "resolved"]
    resolved_at: Optional[datetime] = None
