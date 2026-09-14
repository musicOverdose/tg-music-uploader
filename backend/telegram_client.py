import os
import httpx

class TelegramManager:
    def __init__(self):
        self.bot_token = ""
        self.base_url = "https://api.telegram.org/bot"

    def set_token(self, token: str):
        self.bot_token = token.strip()

    async def get_me(self):
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{self.base_url}{self.bot_token}/getMe")
            data = resp.json()
            if not data.get("ok"): raise Exception(data.get("description", "Auth failed"))
            return data["result"] # Returns full bot info dict

    # NEW: Fetch Channel Info
    async def get_chat(self, chat_id: str):
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{self.base_url}{self.bot_token}/getChat", params={"chat_id": chat_id})
            data = resp.json()
            if not data.get("ok"): raise Exception(data.get("description", "Failed to fetch Channel"))
            return data["result"] # Returns full chat info dict

    async def upload_audio(self, file_path: str, destination: str, metadata: dict, thumb_path: str = None, thumb_bytes: bytes = None):
        url = f"{self.base_url}{self.bot_token}/sendAudio"
        data = {
            "chat_id": destination,
            "title": metadata.get("title", "Unknown"),
            "performer": metadata.get("artist", "Unknown"),
            "duration": str(metadata.get("duration", 0))
        }
        async with httpx.AsyncClient(timeout=300.0) as client:
            with open(file_path, "rb") as audio_file:
                files = {"audio": (os.path.basename(file_path), audio_file, "audio/mpeg")}
                
                thumb_file = None
                if thumb_bytes:
                    files["thumbnail"] = ("cover.jpg", thumb_bytes, "image/jpeg")
                elif thumb_path and os.path.exists(thumb_path):
                    thumb_file = open(thumb_path, "rb")
                    files["thumbnail"] = (os.path.basename(thumb_path), thumb_file, "image/jpeg")
                    
                try: 
                    resp = await client.post(url, data=data, files=files)
                finally:
                    if thumb_file: thumb_file.close()

            res_data = resp.json()
            if resp.status_code == 429: raise Exception(f"FLOOD_WAIT_{res_data.get('parameters', {}).get('retry_after', 30)}")
            if not res_data.get("ok"): raise Exception(res_data.get("description", "Upload failed"))

    async def upload_photo(self, photo_path: str, destination: str, caption: str = ""):
        url = f"{self.base_url}{self.bot_token}/sendPhoto"
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(photo_path, "rb") as photo_file:
                files = {"photo": (os.path.basename(photo_path), photo_file, "image/jpeg")}
                data = {"chat_id": destination, "caption": caption}
                resp = await client.post(url, data=data, files=files)
            
            res_data = resp.json()
            if not res_data.get("ok"): raise Exception(res_data.get("description", "Photo upload failed"))
            return res_data["result"]["message_id"]

    async def edit_message_text(self, chat_id: str, message_id: int, text: str):
        url = f"{self.base_url}{self.bot_token}/editMessageText"
        data = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=data)
            res_data = resp.json()
            if not res_data.get("ok"): raise Exception(res_data.get("description", "Edit failed"))

tg_client = TelegramManager()
