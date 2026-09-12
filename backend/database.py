from typing import Optional
from sqlmodel import Field, SQLModel, create_engine, Session
from datetime import datetime

sqlite_file_name = "/data/app.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, echo=False)

class Settings(SQLModel, table=True):
    id: Optional[int] = Field(default=1, primary_key=True)
    bot_token: str = Field(default="")
    default_dest: str = Field(default="")
    music_root: str = Field(default="/music")
    
    # Rate Limiting
    delay_per_file_min: int = Field(default=3)
    delay_per_file_max: int = Field(default=7)
    
    # NEW: Index/Report Post Settings
    report_channel: str = Field(default="")
    report_message_id: str = Field(default="")
    report_text: str = Field(default="") # Stores the accumulated Markdown list

class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str
    destination: str
    status: str = Field(default="pending") 
    progress: int = Field(default=0)
    error_msg: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_cover_job: bool = Field(default=False)

def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        if not session.get(Settings, 1):
            session.add(Settings(id=1))
            session.commit()
