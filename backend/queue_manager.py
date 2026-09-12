import asyncio
import random
import os
import traceback
from sqlmodel import Session, select
from backend.database import engine, Job, Settings
from backend.telegram_client import tg_client
from backend.library import extract_metadata, find_cover

connected_clients = set()

async def broadcast_progress(job_id: int, progress: int, status: str):
    msg = f'{{"job_id": {job_id}, "progress": {progress}, "status": "{status}"}}'
    for ws in list(connected_clients):
        try:
            await ws.send_text(msg)
        except Exception:
            connected_clients.remove(ws)

async def process_queue():
    print("Worker: Background queue processor started successfully.", flush=True)
    while True:
        try:
            with Session(engine) as session:
                settings = session.get(Settings, 1)
                job = session.exec(
                    select(Job).where(Job.status == "pending").order_by(Job.created_at)
                ).first()
                
            if not job:
                await asyncio.sleep(3)
                continue

            if not settings or not settings.bot_token:
                print(f"Worker: Found job {job.id} but bot_token is missing in Settings. Sleeping.", flush=True)
                await asyncio.sleep(5)
                continue

            print(f"Worker: Starting job {job.id} -> {job.file_path}", flush=True)
            tg_client.set_token(settings.bot_token)

            with Session(engine) as session:
                job.status = "uploading"
                job.progress = 10
                session.add(job)
                session.commit()
                
            await broadcast_progress(job.id, 10, "uploading")

            try:
                if job.is_cover_job:
                    await tg_client.upload_photo(job.file_path, job.destination)
                else:
                    meta = extract_metadata(job.file_path)
                    thumb = find_cover(os.path.dirname(job.file_path))
                    await tg_client.upload_audio(job.file_path, job.destination, meta, thumb)
                
                with Session(engine) as session:
                    job.status = "done"
                    job.progress = 100
                    session.add(job)
                    session.commit()
                await broadcast_progress(job.id, 100, "done")
                print(f"Worker: Job {job.id} finished successfully.", flush=True)

                # Delay logic
                delay = random.uniform(settings.delay_per_file_min, settings.delay_per_file_max)
                await asyncio.sleep(delay)

            except Exception as e:
                err = str(e)
                print(f"Worker: Job {job.id} failed. Error: {err}", flush=True)
                with Session(engine) as session:
                    if "FLOOD_WAIT_" in err:
                        wait_sec = int(err.split("FLOOD_WAIT_")[1])
                        job.status = "pending"
                        job.error_msg = f"Rate limited. Waiting {wait_sec}s"
                        session.add(job)
                        session.commit()
                        await broadcast_progress(job.id, 0, "rate_limited")
                        await asyncio.sleep(wait_sec + 2)
                    else:
                        job.status = "failed"
                        job.error_msg = err
                        session.add(job)
                        session.commit()
                        await broadcast_progress(job.id, 0, "failed")

        except Exception as outer_e:
            print(f"Worker: Fatal error in queue loop: {outer_e}", flush=True)
            traceback.print_exc()
            await asyncio.sleep(5)
