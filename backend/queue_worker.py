import asyncio
import random
from sqlmodel import Session, select
from database import engine
from models import Job, AppSettings
from tg_client import upload_file

# Store active websockets to broadcast progress
active_websockets = []

async def broadcast_progress(job_id: int, current: int, total: int):
    percent = (current / total) * 100 if total > 0 else 0
    # Update DB minimally (every 5%) to avoid DB lock
    if hasattr(broadcast_progress, "last_percent") and percent - broadcast_progress.last_percent.get(job_id, 0) < 5:
        if current != total:
            return
            
    if not hasattr(broadcast_progress, "last_percent"):
        broadcast_progress.last_percent = {}
    broadcast_progress.last_percent[job_id] = percent
    
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job:
            job.progress = percent
            session.add(job)
            session.commit()
            
    # Send to WS
    message = {"job_id": job_id, "progress": percent, "status": "uploading"}
    for ws in active_websockets:
        try:
            await ws.send_json(message)
        except:
            active_websockets.remove(ws)

async def progress_callback(current, total, job_id):
    await broadcast_progress(job_id, current, total)

async def background_worker():
    while True:
        try:
            with Session(engine) as session:
                settings = session.exec(select(AppSettings).where(AppSettings.id == 1)).first()
                if not settings:
                    await asyncio.sleep(5)
                    continue
                    
                job = session.exec(select(Job).where(Job.status == "pending").order_by(Job.created_at)).first()
                
                if not job:
                    await asyncio.sleep(2)
                    continue
                
                job.status = "uploading"
                session.add(job)
                session.commit()
                
            # Perform Upload outside session block
            try:
                await upload_file(job, progress_callback)
                with Session(engine) as session:
                    j = session.get(Job, job.id)
                    j.status = "done"
                    j.progress = 100.0
                    session.add(j)
                    session.commit()
            except Exception as e:
                with Session(engine) as session:
                    j = session.get(Job, job.id)
                    j.status = "failed"
                    j.error_message = str(e)
                    session.add(j)
                    session.commit()

            # Jitter delay between files
            delay = random.uniform(settings.delay_between_files_min, settings.delay_between_files_max)
            await asyncio.sleep(delay)

        except Exception as e:
            print(f"Queue Worker Error: {e}")
            await asyncio.sleep(5)
