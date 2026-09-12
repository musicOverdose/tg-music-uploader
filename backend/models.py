from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class AppSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=1, primary_key=True)
    api_id: Optional[int] = None
    api_hash: Optional[str] = None
    bot_token: Optional[str] = None
    
    # Anti-Rate-Limit settings
    delay_between_files_min: int = Field(default=2)
    delay_between_files_max: int = Field(default=5)
    delay_between_albums: int = Field(default=15)
    max_daily_uploads: int = Field(default=1000)
    
    # Dest
    default_dest_id: Optional[str] = None
    
class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str
    filename: str
    destination_id: str
    status: str = Field(default="pending") # pending, uploading, done, failed, paused
    progress: float = Field(default=0.0)
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_album_cover: bool = Field(default=False)
