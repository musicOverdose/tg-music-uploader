import os
import asyncio
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional
from backend.database import engine, init_db, Settings, Job
from backend.library import get_directory_tree, get_files_in_dir
from backend.telegram_client import tg_client
from backend.queue_manager import process_queue, connected_clients

app = FastAPI(title="Telegram Music Uploader")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "supersecret")
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
        # --- NEW: SELF-HEALING ---
        # Reset any jobs that got stuck in "uploading" during a container restart
        stuck_jobs = session.exec(select(Job).where(Job.status == "uploading")).all()
        for sj in stuck_jobs:
            sj.status = "pending"
            sj.progress = 0
            session.add(sj)
        session.commit()
        
        settings = session.get(Settings, 1)
        if settings and settings.bot_token:
            tg_client.set_token(settings.bot_token)
            
    # Start background queue processor safely
    task = asyncio.create_task(process_queue())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

# --- Routes ---
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

@app.get("/api/library/tree")
def lib_tree():
    with Session(engine) as session:
        settings = session.get(Settings, 1)
    return get_directory_tree(settings.music_root)

@app.get("/api/library/files")
def lib_files(path: str):
    return get_files_in_dir(path)

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
            if cover:
                cover_job = Job(file_path=cover, destination=req.destination, is_cover_job=True)
                session.add(cover_job)

        for f in req.files:
            job = Job(file_path=f, destination=req.destination)
            session.add(job)
        session.commit()
    return {"status": "enqueued"}

@app.get("/api/queue")
def get_queue():
    with Session(engine) as session:
        return session.exec(select(Job).order_by(Job.created_at.desc())).all()

@app.post("/api/queue/clear")
def clear_queue():
    with Session(engine) as session:
        # Also clear stuck pending/uploading if the user presses the button
        jobs = session.exec(select(Job)).all()
        for j in jobs:
            session.delete(j)
        session.commit()
    return {"status": "cleared"}

@app.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

# --- Mount Frontend ---
if os.path.exists("/app/frontend/dist"):
    app.mount("/", StaticFiles(directory="/app/frontend/dist", html=True), name="frontend")
