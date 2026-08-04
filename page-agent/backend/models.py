from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class PlatformMetric(BaseModel):
    platform: str
    followers: int
    reads_views: int
    interactions: int
    engagement_rate: float
    top_content: list[dict]
    recorded_at: str


class DashboardOverview(BaseModel):
    total_followers: int
    daily_new_followers: int
    daily_interactions: int
    content_published: int
    platforms: list[PlatformMetric]
    follower_trend: list[dict]


class CompetitorAccount(BaseModel):
    id: Optional[int] = None
    platform: str
    name: str
    uid: str
    followers: Optional[int] = None
    content_count: Optional[int] = None
    avg_engagement: Optional[int] = None
    last_updated: Optional[str] = None


class ContentItem(BaseModel):
    id: Optional[int] = None
    platform: str
    title: str
    content_type: str
    scheduled_at: Optional[str] = None
    published_at: Optional[str] = None
    status: str = "draft"  # draft / scheduled / published / failed
    reads_views: Optional[int] = None
    interactions: Optional[int] = None


class CollectorTrigger(BaseModel):
    platform: Optional[str] = None  # None = all platforms


class CollectorResult(BaseModel):
    platform: str
    success: bool
    followers: int
    reads_views: int
    interactions: int
    error: Optional[str] = None
