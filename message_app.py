import os
import sys
import threading
from pystray import Icon, Menu, MenuItem
from PIL import Image
import ctypes
import webbrowser
import logging
import uvicorn
from app import app, get_local_ip  # app.py içindeki gerekli fonksiyonları ve uygulamayı dahil edin

# Konsol penceresini gizle (Windows için)
if sys.platform == "win32":
    ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)


def configure_logging():
    """Loglama yapılandırmasını düzenle."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),  # Standart çıktıya logları yönlendir
            logging.FileHandler("app.log", mode="a", encoding="utf-8"),  # Logları dosyaya yaz
        ],
    )
    logging.info("Logging configured successfully.")


def get_icon_image():
    """'duck.png' dosyasını yükleyip ikon olarak kullan."""
    icon_path = os.path.join(os.path.dirname(__file__), "duck.png")
    if not os.path.exists(icon_path):
        raise FileNotFoundError(f"İkon dosyası bulunamadı: {icon_path}")
    return Image.open(icon_path)


def open_app():
    """Konsolu yeniden göster."""
    if sys.platform == "win32":
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 1)


def quit_app(icon, item):
    """Uygulamayı kapat."""
    icon.stop()
    sys.exit()


def run_web_server():
    """Web sunucusunu başlat ve tarayıcıyı aç."""
    local_ip = get_local_ip()  # Yerel IP adresini alın
    web_url = f"http://{local_ip}:4000"  # Sunucu adresini oluştur
    #logging.info(f"Your app is running at: {web_url}")
    webbrowser.open(web_url)

    try:
        # Uvicorn'u başlat
        uvicorn.run(
            app,
            host=local_ip,
            port=4000,
            log_level="error",
            use_colors=False,  # Terminal rengine ihtiyaç olmadığını belirt
        )
    except Exception as e:
        logging.error(f"Web sunucusu başlatılırken bir hata oluştu: {e}")


def start_system_tray():
    """Sistem tepsisi simgesini başlat."""
    try:
        icon = Icon("Duck App")
        icon.icon = get_icon_image()
        icon.menu = Menu(
            MenuItem("Göster", lambda: open_app()),  # Konsolu göster
            MenuItem("Çıkış", quit_app),  # Uygulamayı kapat
        )
        icon.run()
    except Exception as e:
        logging.error(f"Sistem tepsisi başlatılırken bir hata oluştu: {e}")


def main():
    #configure_logging()  # Loglama yapılandırmasını başlat
    #logging.info("Uygulama başlatılıyor...")

    # Web sunucusunu bir iş parçacığında çalıştır
    web_server_thread = threading.Thread(target=run_web_server, daemon=True)
    web_server_thread.start()

    # Sistem tepsisi simgesini başlat
    start_system_tray()


if __name__ == "__main__":
    main()
