import os
import asyncio
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional, Dict
from backend.database import engine, init_db, Settings, Job, UploadedFolder
from backend.library import get_directory_tree, get_files_in_dir
from backend.telegram_client import tg_client
from backend.queue_manager import process_queue, connected_clients

app = FastAPI(title="Telegram Music Uploader")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "supersecret")
REPORT_PATH = "/data/report.txt"
background_tasks = set() 

@app.middleware("http")
async def check_auth(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.url.path not in ["/api/login", "/api/health"]:
        token = request.cookies.get("auth_token")
        if token != ADMIN_PASSWORD:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)

@app.on_event("startup")
async def on_startup():
    init_db()
    with Session(engine) as session:
        stuck_jobs = session.exec(select(Job).where(Job.status == "uploading")).all()
        for sj in stuck_jobs:
            sj.status = "pending"
            sj.progress = 0
            session.add(sj)
        session.commit()
        
        settings = session.get(Settings, 1)
        if settings and settings.bot_token:
            tg_client.set_token(settings.bot_token)
            
    task = asyncio.create_task(process_queue())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

class LoginReq(BaseModel):
    password: str

@app.post("/api/login")
def login(req: LoginReq):
    if req.password == ADMIN_PASSWORD:
        res = JSONResponse({"status": "ok"})
        res.set_cookie("auth_token", req.password, httponly=True, max_age=86400*30)
        return res
    raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.get("/api/settings")
def get_settings():
    with Session(engine) as session:
        return session.get(Settings, 1)

class SettingsUpdate(BaseModel):
    bot_token: str
    default_dest: str
    delay_per_file_min: int
    delay_per_file_max: int

@app.post("/api/settings")
async def update_settings(data: SettingsUpdate):
    with Session(engine) as session:
        settings = session.get(Settings, 1)
        settings.bot_token = data.bot_token
        settings.default_dest = data.default_dest
        settings.delay_per_file_min = data.delay_per_file_min
        settings.delay_per_file_max = data.delay_per_file_max
        session.add(settings)
        session.commit()
        
    if data.bot_token:
        try:
            tg_client.set_token(data.bot_token)
            username = await tg_client.get_me()
            return {"status": "ok", "bot_username": username}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.get("/api/report")
def get_report():
    if not os.path.exists(REPORT_PATH): return {"content": ""}
    with open(REPORT_PATH, "r", encoding="utf-8") as f: return {"content": f.read()}

class ReportUpdateReq(BaseModel):
    content: str

@app.post("/api/report")
def update_report(req: ReportUpdateReq):
    with open(REPORT_PATH, "w", encoding="utf-8") as f: f.write(req.content)
    return {"status": "saved"}

@app.post("/api/report/clear")
def clear_report():
    with open(REPORT_PATH, "w", encoding="utf-8") as f: f.write("")
    return {"status": "cleared"}

@app.get("/api/library/tree")
def lib_tree():
    return get_directory_tree()

@app.get("/api/library/files")
def lib_files(path: str):
    return get_files_in_dir(path)

@app.get("/api/library/cover")
def get_cover_image(path: str):
    from backend.library import find_cover
    cover_path = find_cover(path)
    if cover_path and os.path.exists(cover_path): return FileResponse(cover_path)
    raise HTTPException(status_code=404, detail="Cover not found")

class MetaUpdateReq(BaseModel):
    filepath: str
    title: str
    artist: str
    album: str
    year: str
    track: str

@app.post("/api/library/metadata")
def update_meta(req: MetaUpdateReq):
    from backend.library import update_metadata
    try:
        new_meta = update_metadata(req.filepath, req.model_dump())
        return {"status": "ok", "metadata": new_meta}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

class CleanReq(BaseModel):
    folder_path: str

@app.post("/api/library/metadata/clean")
def clean_meta(req: CleanReq):
    from backend.library import clean_folder_metadata
    try: return {"status": "ok", "cleaned": clean_folder_metadata(req.folder_path)}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/folders/status")
def get_folder_status():
    with Session(engine) as session:
        records = session.exec(select(UploadedFolder)).all()
        return {r.path: r.is_done for r in records}

class FolderStatusReq(BaseModel):
    path: str
    is_done: bool

@app.post("/api/folders/status")
def set_folder_status(req: FolderStatusReq):
    with Session(engine) as session:
        record = session.get(UploadedFolder, req.path)
        if record: record.is_done = req.is_done
        else: record = UploadedFolder(path=req.path, is_done=req.is_done)
        session.add(record)
        session.commit()
    return {"status": "ok"}

class BulkFolderStatusReq(BaseModel):
    status_map: Dict[str, bool]

@app.post("/api/folders/status/bulk")
def bulk_set_folder_status(req: BulkFolderStatusReq):
    with Session(engine) as session:
        for path, is_done in req.status_map.items():
            record = session.get(UploadedFolder, path)
            if record: record.is_done = is_done
            else: session.add(UploadedFolder(path=path, is_done=is_done))
        session.commit()
    return {"status": "ok"}

class EnqueueReq(BaseModel):
    files: List[str]
    destination: str
    include_cover: bool = False

@app.post("/api/queue/add")
def add_to_queue(req: EnqueueReq):
    with Session(engine) as session:
        if req.include_cover and len(req.files) > 0:
            folder = os.path.dirname(req.files[0])
            from backend.library import find_cover
            cover = find_cover(folder)
            if cover: session.add(Job(file_path=cover, destination=req.destination, is_cover_job=True))
        for f in req.files: session.add(Job(file_path=f, destination=req.destination))
        session.commit()
    return {"status": "enqueued"}

class EnqueueFoldersReq(BaseModel):
    folders: List[str]
    destination: str
    include_cover: bool = False

@app.post("/api/queue/add_folders")
def add_folders_to_queue(req: EnqueueFoldersReq):
    with Session(engine) as session:
        from backend.library import find_cover
        for folder in req.folders:
            files = get_files_in_dir(folder)
            if req.include_cover and len(files) > 0:
                cover = find_cover(folder)
                if cover: session.add(Job(file_path=cover, destination=req.destination, is_cover_job=True))
            for f in files: session.add(Job(file_path=f["path"], destination=req.destination))
            record = session.get(UploadedFolder, folder)
            if record: record.is_done = True
            else: session.add(UploadedFolder(path=folder, is_done=True))
        session.commit()
    return {"status": "enqueued"}

@app.get("/api/queue")
def get_queue():
    with Session(engine) as session:
        return session.exec(select(Job).order_by(Job.created_at.desc())).all()

@app.post("/api/queue/clear")
def clear_queue():
    with Session(engine) as session:
        jobs = session.exec(select(Job)).all()
        for j in jobs: session.delete(j)
        session.commit()
    return {"status": "cleared"}

# NEW: Queue Pause & Retry Routes
@app.post("/api/queue/toggle_pause")
def toggle_pause():
    with Session(engine) as session:
        s = session.get(Settings, 1)
        s.is_paused = not s.is_paused
        session.add(s)
        session.commit()
        return {"is_paused": s.is_paused}

@app.post("/api/queue/retry_failed")
def retry_failed():
    with Session(engine) as session:
        failed = session.exec(select(Job).where(Job.status == "failed")).all()
        for j in failed:
            j.status = "pending"
            j.attempts = 0
            session.add(j)
        session.commit()
    return {"status": "ok"}

@app.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

if os.path.exists("/app/frontend/dist"):
    app.mount("/", StaticFiles(directory="/app/frontend/dist", html=True), name="frontend")
