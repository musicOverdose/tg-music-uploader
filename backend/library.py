import os
from mutagen import File as MutagenFile

def get_directory_tree(path="/music"):
    if not os.path.exists(path):
        return []
    tree = []
    for item in os.listdir(path):
        full_path = os.path.join(path, item)
        if os.path.isdir(full_path):
            tree.append({"name": item, "path": full_path, "type": "folder"})
    return sorted(tree, key=lambda x: x["name"].lower())

def get_files_in_dir(path):
    if not os.path.exists(path) or not os.path.isdir(path):
        return []
    
    files = []
    cover_found = find_cover(path) is not None

    for item in os.listdir(path):
        if item.lower().endswith('.mp3'):
            full_path = os.path.join(path, item)
            size = os.path.getsize(full_path)
            meta = extract_metadata(full_path)
            files.append({
                "filename": item,
                "path": full_path,
                "size": size,
                "metadata": meta,
                "has_folder_cover": cover_found
            })
            
    # Sort files by their embedded track number, fallback to filename if missing
    return sorted(files, key=lambda x: (x["metadata"]["track"], x["filename"].lower()))

def find_cover(folder_path):
    valid_names = ['cover.jpg', 'folder.jpg', 'cover.png', 'front.jpg']
    for name in valid_names:
        p = os.path.join(folder_path, name)
        if os.path.exists(p): return p
    for item in os.listdir(folder_path):
        if item.lower() in valid_names: return os.path.join(folder_path, item)
    return None

def extract_metadata(filepath):
    try:
        audio = MutagenFile(filepath)
        if audio is None: raise Exception()
        
        title = audio.tags.get('TIT2', [None])[0] if 'TIT2' in audio.tags else None
        artist = audio.tags.get('TPE1', [None])[0] if 'TPE1' in audio.tags else None
        album = audio.tags.get('TALB', [None])[0] if 'TALB' in audio.tags else None
        duration = int(audio.info.length) if hasattr(audio.info, 'length') else 0
        
        # Track parsing (e.g. "1/12" -> 1)
        track_raw = str(audio.tags.get('TRCK', [0])[0]) if 'TRCK' in audio.tags else '0'
        track_num = int(track_raw.split('/')[0]) if track_raw and track_raw.split('/')[0].isdigit() else 0
        
        # Year parsing
        year = "Unknown"
        if 'TDRC' in audio.tags: year = str(audio.tags.get('TDRC')[0].text[0])[:4]
        elif 'TYER' in audio.tags: year = str(audio.tags.get('TYER')[0])[:4]
        
        return {
            "title": str(title) if title else "Unknown Title",
            "artist": str(artist) if artist else "Unknown Artist",
            "album": str(album) if album else "Unknown Album",
            "duration": duration,
            "track": track_num,
            "year": year
        }
    except Exception:
        return {"title": "Unknown", "artist": "Unknown", "album": "Unknown", "duration": 0, "track": 0, "year": "Unknown"}
