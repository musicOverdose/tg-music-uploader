import os
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3

MUSIC_ROOT = "/music"

def scan_directory(path: str = ""):
    full_path = os.path.join(MUSIC_ROOT, path)
    if not os.path.exists(full_path):
        return []
        
    items = []
    for entry in os.scandir(full_path):
        if entry.is_dir():
            items.append({
                "type": "folder",
                "name": entry.name,
                "path": os.path.join(path, entry.name)
            })
        elif entry.is_file() and entry.name.lower().endswith('.mp3'):
            file_info = get_mp3_info(entry.path)
            items.append({
                "type": "file",
                "name": entry.name,
                "path": os.path.join(path, entry.name),
                "metadata": file_info
            })
    return sorted(items, key=lambda x: (x['type'] == 'file', x['name']))

def get_mp3_info(file_path: str):
    try:
        audio = MP3(file_path, ID3=EasyID3)
        return {
            "title": audio.get("title", [""])[0],
            "artist": audio.get("artist", [""])[0],
            "album": audio.get("album", [""])[0],
            "duration": int(audio.info.length) if audio.info else 0
        }
    except Exception:
        return {"title": os.path.basename(file_path), "artist": "", "album": "", "duration": 0}

def find_cover(dir_path: str):
    valid_names = ["cover.jpg", "folder.jpg", "cover.png", "front.jpg"]
    for name in valid_names:
        cover_path = os.path.join(dir_path, name)
        if os.path.exists(cover_path):
            return cover_path
    # Case insensitive fallback
    for file in os.listdir(dir_path):
        if file.lower() in valid_names:
            return os.path.join(dir_path, file)
    return None
