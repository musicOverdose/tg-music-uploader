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
                
                job_id, job_is_cover, job_file_path, job_dest = job.id, job.is_cover_job, job.file_path, job.destination
                bot_token, delay_min, delay_max = settings.bot_token, settings.delay_per_file_min, settings.delay_per_file_max
                rep_chan, rep_msg, rep_text = settings.report_channel, settings.report_message_id, settings.report_text

            tg_client.set_token(bot_token)
            await broadcast_progress(job_id, 10, "uploading")

            try:
                if job_is_cover:
                    # Parse Album/Year from the first mp3 in the folder
                    folder = os.path.dirname(job_file_path)
                    mp3s = [f for f in os.listdir(folder) if f.lower().endswith('.mp3')]
                    album_name, year = "Unknown", "Unknown"
                    if mp3s:
                        meta = extract_metadata(os.path.join(folder, mp3s[0]))
                        album_name, year = meta.get("album", "Unknown"), meta.get("year", "Unknown")
                    
                    caption = f"{year} - {album_name}"
                    msg_id = await tg_client.upload_photo(job_file_path, job_dest, caption=caption)

                    # Update the Report/Index Message if configured
                    if rep_chan and rep_msg:
                        dest_str = str(job_dest)
                        # Build link (t.me/c/123/45 or t.me/channel/45)
                        link = f"https://t.me/c/{dest_str[4:]}/{msg_id}" if dest_str.startswith("-100") else f"https://t.me/{dest_str.strip('@')}/{msg_id}"
                        new_line = f'<a href="{link}">{year} - {album_name}</a>'
                        new_text = (rep_text + "\n" + new_line).strip() if rep_text else new_line
                        
                        try:
                            await tg_client.edit_message_text(rep_chan, int(rep_msg), new_text)
                            with Session(engine) as s:
                                s_fresh = s.get(Settings, 1)
                                s_fresh.report_text = new_text
                                s.add(s_fresh)
                                s.commit()
                        except Exception as e: print(f"Index Update Failed: {e}")

                else:
                    meta = extract_metadata(job_file_path)
                    thumb = find_cover(os.path.dirname(job_file_path))
                    await tg_client.upload_audio(job_file_path, job_dest, meta, thumb)
                
                with Session(engine) as session:
                    f_job = session.get(Job, job_id)
                    f_job.status, f_job.progress = "done", 100
                    session.add(f_job)
                    session.commit()
                        
                await broadcast_progress(job_id, 100, "done")
                await asyncio.sleep(random.uniform(delay_min, delay_max))

            except Exception as e:
                with Session(engine) as session:
                    failed_job = session.get(Job, job_id)
                    if "FLOOD_WAIT_" in str(e):
                        w = int(str(e).split("FLOOD_WAIT_")[1])
                        failed_job.status, failed_job.error_msg = "pending", f"Rate limited. Wait {w}s"
                        session.add(failed_job)
                        session.commit()
                        await asyncio.sleep(w + 2)
                    else:
                        failed_job.status, failed_job.error_msg = "failed", str(e)
                        session.add(failed_job)
                        session.commit()
        except Exception:
            await asyncio.sleep(5)
