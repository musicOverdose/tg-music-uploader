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
    print("Worker: Started. Processing strictly 1-by-1.", flush=True)
    while True:
        try:
            # 1. Fetch the job and lock it in the SAME database session
            with Session(engine) as session:
                settings = session.get(Settings, 1)
                job = session.exec(
                    select(Job).where(Job.status == "pending").order_by(Job.created_at)
                ).first()
                
                if not job:
                    await asyncio.sleep(3)
                    continue

                if not settings or not settings.bot_token:
                    await asyncio.sleep(5)
                    continue

                print(f"Worker: Found job {job.id}. Locking queue.", flush=True)
                
                # Lock it immediately before closing this session block
                job.status = "uploading"
                job.progress = 10
                session.add(job)
                session.commit()
                
                # Save the info we need to variables so we don't rely on the closed DB object
                job_id = job.id
                job_is_cover = job.is_cover_job
                job_file_path = job.file_path
                job_dest = job.destination
                bot_token = settings.bot_token
                delay_min = settings.delay_per_file_min
                delay_max = settings.delay_per_file_max

            # 2. Proceed with the actual upload (outside the DB session)
            tg_client.set_token(bot_token)
            await broadcast_progress(job_id, 10, "uploading")

            try:
                if job_is_cover:
                    await tg_client.upload_photo(job_file_path, job_dest)
                else:
                    meta = extract_metadata(job_file_path)
                    thumb = find_cover(os.path.dirname(job_file_path))
                    await tg_client.upload_audio(job_file_path, job_dest, meta, thumb)
                
                # 3. Open a new session to mark it as done
                with Session(engine) as session:
                    finished_job = session.get(Job, job_id)
                    if finished_job:
                        finished_job.status = "done"
                        finished_job.progress = 100
                        session.add(finished_job)
                        session.commit()
                        
                await broadcast_progress(job_id, 100, "done")
                print(f"Worker: Job {job_id} done. Sleeping before next file...", flush=True)

                delay = random.uniform(delay_min, delay_max)
                await asyncio.sleep(delay)

            except Exception as e:
                err = str(e)
                print(f"Worker: Job {job_id} failed -> {err}", flush=True)
                # Open a new session to log the error
                with Session(engine) as session:
                    failed_job = session.get(Job, job_id)
                    if failed_job:
                        if "FLOOD_WAIT_" in err:
                            wait_sec = int(err.split("FLOOD_WAIT_")[1])
                            failed_job.status = "pending"
                            failed_job.error_msg = f"Rate limited. Waiting {wait_sec}s"
                            session.add(failed_job)
                            session.commit()
                            await broadcast_progress(job_id, 0, "rate_limited")
                            await asyncio.sleep(wait_sec + 2)
                        else:
                            failed_job.status = "failed"
                            failed_job.error_msg = err
                            session.add(failed_job)
                            session.commit()
                            await broadcast_progress(job_id, 0, "failed")

        except Exception as outer_e:
            print(f"Worker: Error: {outer_e}", flush=True)
            await asyncio.sleep(5)
