<div align="center">
  
  # 🎧 Telegram Music Uploader
  **A premium, self-hosted Studio Panel to manage and upload your local music library to Telegram.**

  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
  [![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Modern-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

  <img src="https://img.shields.io/badge/Made_by-Farzad_(@MusicOverdose)-indigo?style=for-the-badge" alt="Made by Farzad" />

  <br />
  <p align="center">
    An elegant, rate-limit-safe web dashboard for uploading entire MP3 albums directly from your VPS to Telegram channels and groups, complete with ID3 tags and cover art.
  </p>

</div>

---

## ✨ Key Features

* 🎛️ **Premium "Studio Panel" WebUI**: A stunning, modern dark-mode interface built with React, Vite, and TailwindCSS, featuring glass-morphism and live WebSocket updates.
* 📂 **Local Library Browser**: Browse your VPS music folders directly from your browser.
* 🎵 **Smart Metadata**: Automatically extracts ID3 tags (Title, Artist, Duration) and detects `cover.jpg` to send visually perfect Telegram audio files.
* 🚦 **Intelligent Queue System**: Built-in background worker that processes uploads sequentially.
* 🛡️ **Rate Limit Protection**: Fully customizable minimum and maximum delays between songs, with automatic handling of Telegram's `FLOOD_WAIT` restrictions.
* 🐳 **Frictionless Deployment**: Packaged as a lightweight multi-stage Docker container optimized for Portainer.

---

## 🛠️ Tech Stack

### Backend
* **Python 3.11** + **FastAPI**: High-performance asynchronous REST API.
* **SQLite** + **SQLModel**: Persistent storage for background jobs and settings.
* **HTTPX**: Direct asynchronous communication with the Telegram Bot API.
* **Mutagen**: For precise audio metadata extraction.

### Frontend
* **React 18** + **Vite**: Lightning-fast UI rendering.
* **Tailwind CSS**: Custom dark-mode utility styling.
* **Lucide React**: Beautiful, consistent iconography.

---

## 🚀 Quick Start (Docker / Portainer)

This project is built to be deployed seamlessly using **Docker Compose** or **Portainer**.

### 1. Preparation
Ensure your music is located in a folder on your host machine (e.g., `/opt/tg-music-uploader/music`) and create a folder for the database (`/opt/tg-music-uploader/data`).

### 2. Portainer Stack (Recommended)
1. Open Portainer -> **Stacks** -> **Add Stack**.
2. Name it `music-uploader`.
3. Choose **Repository** and paste this GitHub repository URL.
4. Add the following **Environment Variable**:
   * `ADMIN_PASSWORD` = `YourSecureLoginPassword`
5. Click **Deploy the stack**.

### 3. Docker Compose (Alternative)
If you prefer the command line, create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  uploader:
    build: [https://github.com/MusicOverdose/tg-music-uploader.git#main](https://github.com/MusicOverdose/tg-music-uploader.git#main)
    container_name: tg-music-uploader
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      - ADMIN_PASSWORD=YourSecureLoginPassword
      - TZ=Asia/Tehran
    volumes:
      - /path/to/your/data:/data
      - /path/to/your/music:/music:ro
