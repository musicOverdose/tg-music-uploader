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
    An elegant, rate-limit-safe web dashboard for uploading entire MP3 albums directly from your VPS to Telegram channels and groups, complete with ID3 tags, dynamic thumbnail resizing, and automated cataloging.
  </p>

</div>

---

## ✨ Key Features

* 🎛️ **Premium "Studio Panel" WebUI**: A stunning, modern dark-mode interface built with React, Vite, and TailwindCSS, featuring glass-morphism and live WebSocket updates.
* 📝 **Built-in ID3 Metadata Editor**: Edit Title, Artist, Album, Year, and Track numbers directly from your browser. Includes a **Bulk Clean** tool to strip out unwanted lyrics or junk tags.
* 🖼️ **Smart Cover Art Engine**: Automatically extracts embedded high-res APIC cover art from MP3s and dynamically resizes them (using Pillow) to bypass Telegram's strict 320x320 thumbnail limits for guaranteed visual previews.
* 🚦 **Advanced Queue Management**: Full control over your uploads. Features Active, Completed, and Failed tabs, "Move to Top" prioritization, and a master Pause/Resume switch. Auto-pauses after 3 failed retries to protect your channel's upload order.
* 🗂️ **Automated Catalog Indexer**: Automatically generates a downloadable `report.txt` file containing beautifully formatted Markdown links (`[Year - Album](link)`) of your uploaded albums for easy channel indexing.
* 🛡️ **Rate Limit Protection**: Fully customizable minimum and maximum delays between songs, with automatic handling of Telegram's `FLOOD_WAIT` restrictions.
* 📂 **Bulk Operations**: Multi-select folders, track "Done" statuses, and push dozens of albums to the queue with a single click.

---

## 🛠️ Tech Stack

### Backend
* **Python 3.11** + **FastAPI**: High-performance asynchronous REST API.
* **SQLite** + **SQLModel**: Persistent storage for background jobs, folder states, and settings.
* **HTTPX**: Direct asynchronous communication with the Telegram Bot API.
* **Mutagen & Pillow**: For precise audio metadata extraction and dynamic image resizing.
* **WebSockets**: Real-time progress bar streaming to the UI.

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
      # NOTE: Do NOT use ':ro' (read-only) if you want to use the Metadata Editor/Cleaner features!
      - /path/to/your/music:/music
