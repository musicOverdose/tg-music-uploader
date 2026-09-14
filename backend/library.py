import os
import io
from PIL import Image
from mutagen import File as MutagenFile
from mutagen.id3 import ID3, TIT2, TPE1, TALB, TDRC, TYER, TRCK, ID3NoHeaderError

def get_directory_tree(path="/music"):
    if not os.path.exists(path): return {"tree": [], "total_folders": 0, "total_files": 0}
    tree = []
    total_files = 0
    for item in os.listdir(path):
        full_path = os.path.join(path, item)
        if os.path.isdir(full_path):
            mp3_count = len([f for f in os.listdir(full_path) if f.lower().endswith('.mp3')])
            total_files += mp3_count
            tree.append({"name": item, "path": full_path, "type": "folder"})
    tree.sort(key=lambda x: x["name"].lower())
    return {"tree": tree, "total_folders": len(tree), "total_files": total_files}

def get_files_in_dir(path):
    if not os.path.exists(path) or not os.path.isdir(path): return []
    files = []
    cover_found = find_cover(path) is not None
    for item in os.listdir(path):
        if item.lower().endswith('.mp3'):
            full_path = os.path.join(path, item)
            files.append({
                "filename": item, "path": full_path,
                "size": os.path.getsize(full_path),
                "metadata": extract_metadata(full_path),
                "has_folder_cover": cover_found
            })
    return sorted(files, key=lambda x: (x["metadata"]["track"], x["filename"].lower()))

def find_cover(folder_path):
    for name in ['cover.jpg', 'folder.jpg', 'cover.png', 'front.jpg']:
        p = os.path.join(folder_path, name)
        if os.path.exists(p): return p
    for item in os.listdir(folder_path):
        if item.lower() in ['cover.jpg', 'folder.jpg', 'cover.png', 'front.jpg']: 
            return os.path.join(folder_path, item)
    return None

def extract_and_resize_cover_from_mp3(filepath):
    try:
        audio = ID3(filepath)
        for tag in audio.values():
            if tag.FrameID == 'APIC':
                img_data = tag.data
                img = Image.open(io.BytesIO(img_data))
                img.thumbnail((320, 320))
                out = io.BytesIO()
                img.convert("RGB").save(out, format="JPEG", quality=85)
                out.seek(0)
                return out.read()
    except Exception:
        pass
    return None

def extract_metadata(filepath):
    try:
        audio = MutagenFile(filepath)
        if audio is None: raise Exception()
        
        title = audio.tags.get('TIT2', [None])[0] if 'TIT2' in audio.tags else None
        artist = audio.tags.get('TPE1', [None])[0] if 'TPE1' in audio.tags else None
        album = audio.tags.get('TALB', [None])[0] if 'TALB' in audio.tags else None
        track_raw = str(audio.tags.get('TRCK', [0])[0]) if 'TRCK' in audio.tags else '0'
        track_num = int(track_raw.split('/')[0]) if track_raw and track_raw.split('/')[0].isdigit() else 0
        
        year = "Unknown"
        for tag_id in ['TDRC', 'TYER', 'TDOR']:
            if tag_id in audio.tags:
                val = str(audio.tags[tag_id])
                import re
                match = re.search(r'\b(19\d\d|20\d\d)\b', val)
                if match:
                    year = match.group(1)
                    break
                elif len(val.strip()) >= 4 and val.strip()[:4].isdigit():
                    year = val.strip()[:4]
                    break
        
        bitrate = int(audio.info.bitrate / 1000) if hasattr(audio.info, 'bitrate') else 0
        
        return {
            "title": str(title) if title else "Unknown Title",
            "artist": str(artist) if artist else "Unknown Artist",
            "album": str(album) if album else "Unknown Album",
            "duration": int(audio.info.length) if hasattr(audio.info, 'length') else 0,
            "track": track_num, "year": year, "bitrate": bitrate
        }
    except:
        return {"title": "Unknown", "artist": "Unknown", "album": "Unknown", "duration": 0, "track": 0, "year": "Unknown", "bitrate": 0}

def update_metadata(filepath, meta):
    try: audio = ID3(filepath)
    except ID3NoHeaderError: audio = ID3()
    
    if "title" in meta: audio.add(TIT2(encoding=3, text=str(meta["title"])))
    if "artist" in meta: audio.add(TPE1(encoding=3, text=str(meta["artist"])))
    if "album" in meta: audio.add(TALB(encoding=3, text=str(meta["album"])))
    if "year" in meta: audio.add(TDRC(encoding=3, text=str(meta["year"])))
    if "track" in meta: audio.add(TRCK(encoding=3, text=str(meta["track"])))
    
    audio.save(filepath, v2_version=3)
    return extract_metadata(filepath)

def clean_folder_metadata(folder_path):
    allowed = {'TIT2', 'TPE1', 'TALB', 'TDRC', 'TYER', 'TRCK', 'TLEN', 'TDOR'}
    cleaned_count = 0
    for item in os.listdir(folder_path):
        if item.lower().endswith('.mp3'):
            p = os.path.join(folder_path, item)
            try:
                audio = ID3(p)
                to_delete = [frame for frame in audio.keys() if frame not in allowed and not frame.startswith('APIC')]
                if to_delete:
                    for frame in to_delete: audio.delall(frame)
                    audio.save(p, v2_version=3)
                    cleaned_count += 1
            except: pass
    return cleaned_count
