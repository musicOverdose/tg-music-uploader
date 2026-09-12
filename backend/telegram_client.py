import os
import httpx

class TelegramManager:
    def __init__(self):
        self.bot_token = ""
        self.base_url = "https://api.telegram.org/bot"

    def set_token(self, token: str):
        self.bot_token = token.strip()

    async def get_me(self):
        if not self.bot_token:
            raise Exception("Bot token not configured")
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{self.base_url}{self.bot_token}/getMe")
            data = resp.json()
            if not data.get("ok"):
                raise Exception(data.get("description", "Failed to authenticate"))
            return data["result"]["username"]

    async def upload_audio(self, file_path: str, destination: str, metadata: dict, thumb_path: str = None):
        if not self.bot_token:
            raise Exception("Bot token not set")

        file_size = os.path.getsize(file_path)
        if file_size > 50 * 1024 * 1024:
            raise Exception(f"File exceeds 50 MB API limit ({file_size / (1024*1024):.1f} MB)")

        url = f"{self.base_url}{self.bot_token}/sendAudio"
        data = {
            "chat_id": destination,
            "title": metadata.get("title", "Unknown"),
            "performer": metadata.get("artist", "Unknown"),
            "duration": str(metadata.get("duration", 0))
        }

        print(f"Telegram Client: Sending {os.path.basename(file_path)} to {destination}...", flush=True)

        async with httpx.AsyncClient(timeout=300.0) as client:
            with open(file_path, "rb") as audio_file:
                files = {"audio": (os.path.basename(file_path), audio_file, "audio/mpeg")}
                
                thumb_file = None
                if thumb_path and os.path.exists(thumb_path):
                    thumb_file = open(thumb_path, "rb")
                    files["thumbnail"] = (os.path.basename(thumb_path), thumb_file, "image/jpeg")

                try:
                    resp = await client.post(url, data=data, files=files)
                finally:
                    if thumb_file:
                        thumb_file.close()

            res_data = resp.json()
            print(f"Telegram Client Response: {res_data}", flush=True)

            if resp.status_code == 429:
                retry_after = res_data.get("parameters", {}).get("retry_after", 30)
                raise Exception(f"FLOOD_WAIT_{retry_after}")
            
            if not res_data.get("ok"):
                raise Exception(res_data.get("description", "Upload failed"))

    async def upload_photo(self, photo_path: str, destination: str):
        if not self.bot_token:
            raise Exception("Bot token not set")

        url = f"{self.base_url}{self.bot_token}/sendPhoto"
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(photo_path, "rb") as photo_file:
                files = {"photo": (os.path.basename(photo_path), photo_file, "image/jpeg")}
                resp = await client.post(url, data={"chat_id": destination}, files=files)
            
            res_data = resp.json()
            if not res_data.get("ok"):
                raise Exception(res_data.get("description", "Photo upload failed"))

tg_client = TelegramManager()
