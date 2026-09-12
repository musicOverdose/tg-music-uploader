import asyncio
import random
import os
from sqlmodel import Session, select
from backend.database import engine, Job, Settings
from backend.telegram_client import tg_client
from backend.library import extract_metadata, find_cover

connected_clients = set()

async def broadcast_progress(job_id: int, progress: int, status: str):
    msg = f'{{"job_id": {job_id}, "progress": {progress}, "status": "{status}"}}'
    for ws in list(connected_clients):
        try: await ws.send_text(msg)
        except: connected_clients.remove(ws)

def append_to_report(year: str, album: str, link: str):
    report_file = "/data/report.txt"
    line = f"[{year} - {album}]({link})\n"
    try:
        with open(report_file, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        print(f"Failed to write to report.txt: {e}", flush=True)

async def process_queue():
    while True:
        try:
            with Session(engine) as session:
                settings = session.get(Settings, 1)
                job = session.exec(select(Job).where(Job.status == "pending").order_by(Job.created_at)).first()
                if not job or not settings or not settings.bot_token:
                    await asyncio.sleep(3)
                    continue

                job.status, job.progress = "uploading", 10
                session.add(job)
                session.commit()
                
                job_id = job.id
                job_is_cover = job.is_cover_job
                job_file_path = job.file_path
                job_dest = job.destination
                bot_token = settings.bot_token
                delay_min = settings.delay_per_file_min
                delay_max = settings.delay_per_file_max

            tg_client.set_token(bot_token)
            await broadcast_progress(job_id, 10, "uploading")

            try:
                if job_is_cover:
                    folder = os.path.dirname(job_file_path)
                    mp3s = [f for f in os.listdir(folder) if f.lower().endswith('.mp3')]
                    album_name, year = "Unknown", "Unknown"
                    if mp3s:
                        meta = extract_metadata(os.path.join(folder, mp3s[0]))
                        album_name = meta.get("album", "Unknown")
                        year = meta.get("year", "Unknown")
                    
                    caption = f"{year} - {album_name}"
                    msg_id = await tg_client.upload_photo(job_file_path, job_dest, caption=caption)

                    # Build Telegram post link
                    dest_str = str(job_dest).strip()
                    if dest_str.startswith("-100"):
                        raw_id = dest_str[4:]
                        link = f"https://t.me/c/{raw_id}/{msg_id}"
                    else:
                        clean_chan = dest_str.lstrip("@")
                        link = f"https://t.me/{clean_chan}/{msg_id}"

                    append_to_report(year, album_name, link)

                else:
                    meta = extract_metadata(job_file_path)
                    thumb = find_cover(os.path.dirname(job_file_path))
                    await tg_client.upload_audio(job_file_path, job_dest, meta, thumb)
                
                with Session(engine) as session:
                    f_job = session.get(Job, job_id)
                    if f_job:
                        f_job.status, f_job.progress = "done", 100
                        session.add(f_job)
                        session.commit()
                        
                await broadcast_progress(job_id, 100, "done")
                await asyncio.sleep(random.uniform(delay_min, delay_max))

            except Exception as e:
                err = str(e)
                print(f"Worker: Job {job_id} failed -> {err}", flush=True)
                with Session(engine) as session:
                    failed_job = session.get(Job, job_id)
                    if failed_job:
                        if "FLOOD_WAIT_" in err:
                            w = int(err.split("FLOOD_WAIT_")[1])
                            failed_job.status, failed_job.error_msg = "pending", f"Rate limited. Wait {w}s"
                            session.add(failed_job)
                            session.commit()
                            await broadcast_progress(job_id, 0, "rate_limited")
                            await asyncio.sleep(w + 2)
                        else:
                            failed_job.status, failed_job.error_msg = "failed", err
                            session.add(failed_job)
                            session.commit()
                            await broadcast_progress(job_id, 0, "failed")

        except Exception as outer_e:
            print(f"Worker: Loop error: {outer_e}", flush=True)
            await asyncio.sleep(5)
