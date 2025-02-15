import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import json
import os
import socket
import logging
import uvicorn
from datetime import datetime
import webbrowser

app = FastAPI()

# Sabit dizin tanımlaması
BASE_DIR = os.path.join("C:\\", "message_app")

# Dizin yoksa oluştur
if not os.path.exists(BASE_DIR):
    os.makedirs(BASE_DIR)

MESSAGE_FILE = os.path.join(BASE_DIR, "messages.json")
LOG_FILE = os.path.join(BASE_DIR, "app.log")


# Statik dosyalar ve şablonlar için yolları dinamik ayarlayın
def get_base_path():
    if getattr(sys, 'frozen', False):  # PyInstaller ile paketlenmişse
        return sys._MEIPASS
    return os.path.abspath(".")


app.mount("/static", StaticFiles(directory=os.path.join(get_base_path(), "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(get_base_path(), "templates"))

# Loglama
logging.basicConfig(filename=LOG_FILE, level=logging.ERROR)


# Mesajları JSON dosyasından yükle
def load_messages():
    """Mesajları JSON dosyasından yükle."""
    if os.path.exists(MESSAGE_FILE):
        with open(MESSAGE_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, list):  # Verinin liste formatında olduğunu kontrol et
                    return data
                else:
                    print("Hata: JSON verisi liste formatında değil!")
                    return []  # Boş liste döndür
            except json.JSONDecodeError:
                print("Geçersiz JSON formatı! Boş liste döndürülüyor.")
                return []  # JSON hatası durumunda boş liste döndür
    return []  # Dosya yoksa boş liste döndür


def save_messages(messages):
    """Mesajları JSON dosyasına kaydet."""
    if isinstance(messages, list):  # Mesajların bir liste olduğunu kontrol et
        with open(MESSAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=4)
    else:
        print("Hata: Mesajlar liste formatında değil!")


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def get_user_ip(websocket: WebSocket):
    """Retrieve the IP address of the client connected via WebSocket."""
    return websocket.client.host


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        """Mesajı tüm bağlantılara gönder."""
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_except_sender(self, sender_ip: str, message: str):
        """Mesajı, gönderen istemci hariç tüm bağlantılara gönder."""
        for connection in self.active_connections:
            if connection.client.host != sender_ip:  # Gönderen istemciyi atla
                await connection.send_text(message)


manager = ConnectionManager()

# Uygulama başlatıldığında mesajları yükle
messages = load_messages()


@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    user_agent = request.headers.get('User-Agent', '').lower()

    # Cihaz türünü tespit et
    if 'android' in user_agent or 'iphone' in user_agent or 'ipad' in user_agent:
        # Mobil cihaz tespit edildi
        return templates.TemplateResponse("mobile.html", {"request": request, "messages": messages})
    else:
        # Masaüstü cihaz tespit edildi
        return templates.TemplateResponse("desktop.html", {"request": request, "messages": messages})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    user_ip = get_user_ip(websocket)  # Kullanıcının IP adresini alıyoruz
    try:
        # Mesaj geldiğinde, yalnızca diğer istemcilere göndereceğiz
        for message in messages:
            await websocket.send_text(json.dumps(message))  # Var olan mesajları gönder

        while True:
            data = await websocket.receive_text()

            try:
                message_data = json.loads(data)  # JSON'u çözümle
                if "message" not in message_data:
                    continue  # Eğer mesaj yoksa, devam et

                # Tarihi insan okunabilir bir formatta al
                timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
                message = {
                    "timestamp": timestamp,
                    "sender": user_ip,  # IP adresini gönderen olarak ekle
                    "message": message_data["message"]
                }
                messages.append(message)
                save_messages(messages)  # Mesajları kaydet

                # Gönderen istemciyi hariç tutmadan tüm istemcilere mesaj gönder
                await manager.broadcast(json.dumps(message))

            except json.JSONDecodeError:
                continue  # JSON geçersizse devam et

    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/check")
async def check_for_new_messages():
    if not messages:
        return {"last_message_time": 0}  # If no messages exist, return 0

    last_message = messages[-1]
    if isinstance(last_message, dict) and "timestamp" in last_message:
        last_message_time = last_message["timestamp"]
    else:
        last_message_time = 0  # Fallback if the last message is malformed

    return {"last_message_time": last_message_time}


def main():
    local_ip = get_local_ip()
    web_url = f"http://{local_ip}:4000"
    print(f"Your app is running at: {web_url}")
    webbrowser.open(web_url)
    uvicorn.run(app, host=local_ip, port=4000, log_level="error")


if __name__ == "__main__":
    main()
