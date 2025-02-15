const darkModeToggle = document.getElementById("darkModeToggle");
const body = document.body;
const messageInput = document.getElementById("messageInput");
const sendMessageButton = document.getElementById("sendMessage");
const messageList = document.getElementById("messageList");
const messageForm = document.getElementById("messageForm");
const errorNotification = document.getElementById("errorNotification");
let shouldAutoScroll = false;
let currentUser = null;  // Initially set to null
let isSendingMessage = false; // Mesaj gönderimi durumunu takip et

// WebSocket initialization
const ws = new WebSocket(`ws://${window.location.host}/ws`);

// WebSocket message event listener
// WebSocket message event listener
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        scrollToBottom();
        shouldAutoScroll = true; // Enable auto-scrolling after the page is loaded
    }, 100); // Wait 100ms to ensure the page is rendered before scrolling

    if (localStorage.getItem("darkMode") === "enabled") {
        body.classList.add("dark-mode");
    }

    let startY = 0;
    let pullDistance = 0;
    const pullThreshold = 100; // Minimum pull distance
    let isPulling = false;
    const refreshOverlay = createRefreshOverlay();

    // Create pull-to-refresh overlay
    function createRefreshOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pull-to-refresh-overlay';
        const spinner = document.createElement('div');
        spinner.classList.add('spinner');
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
        return overlay;
    }

    window.addEventListener('touchstart', (e) => {
        const touchStartY = e.touches[0].clientY;

        // Only start pull-to-refresh at the top of the page
        if ((document.documentElement.scrollTop <= 5 || document.body.scrollTop <= 5) && touchStartY <= 50) {
            startY = touchStartY;
            isPulling = true;
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (!isPulling) return;

        const currentY = e.touches[0].clientY;
        pullDistance = currentY - startY;

        // Only move overlay when pulling down from the top
        if (pullDistance > 0 && (document.documentElement.scrollTop <= 5 || document.body.scrollTop <= 5)) {
            e.preventDefault(); // Prevent default browser movement
            const clampedPullDistance = Math.min(pullDistance, pullThreshold);

            // Show overlay when pulling down
            refreshOverlay.style.transform = `translateX(-50%) translateY(${clampedPullDistance}px)`;
            if (clampedPullDistance > 0) {
                refreshOverlay.classList.add('show');
            }
        }
    });

    window.addEventListener('touchend', (e) => {
        if (!isPulling) return;

        // Reload page if pull threshold is exceeded
        if (pullDistance > pullThreshold && (document.documentElement.scrollTop <= 5 || document.body.scrollTop <= 5)) {
            location.reload();
        } else {
            // Reset overlay
            refreshOverlay.style.transform = 'translateX(-50%) translateY(-100%)';
            refreshOverlay.classList.remove('show');
        }

        pullDistance = 0;
        isPulling = false;
    });

    // Tarayıcı varsayılan pull-to-refresh'i engelle
    document.body.style.overscrollBehaviorY = 'contain';

      // Disable interaction for send button and dark mode toggle
    sendMessageButton.style.userSelect = 'none';  // Disable text selection

    darkModeToggle.style.userSelect = 'none';  // Disable text selection


        // Enable interaction for send button and dark mode toggle
    sendMessageButton.style.pointerEvents = 'auto';  // Allow click events
    darkModeToggle.style.pointerEvents = 'auto';  // Allow click events


});

// WebSocket message receiving

// Yeni mesaj bildirimi fonksiyonu
function showNewMessageNotification() {
    if (isSendingMessage) return;

        const notification = document.getElementById("newMessageNotification");

        // Bildirimi göster
        notification.style.display = "block";  // Bildirimi görünür yap
        notification.classList.add("show");
        // Yazıyı seçilememe durumu

        // Bildirim kutusuna tıklandığında hemen gizlenmesi ve otomatik kaydırma
        notification.addEventListener("click", () => {
        notification.style.display = "none";  // Bildirimi gizle
        notification.classList.remove("show");  // CSS class'ını kaldır

        scrollToBottom();  // Tıklayınca en alta kaydır
    });

    // 5 saniye sonra bildirim kutusunu gizle
    setTimeout(() => {
        notification.style.display = "none";  // Bildirim gizlensin
        notification.classList.remove("show"); // CSS class'ını kaldır
    }, 5000);  // 5 saniye sonra gizlensin
}

// Kopyalandı bildirimi (mobilde gösterme)
// Kopyalandı bildirimi
function copyMessage(message) {
    // Mesajı kopyalamak için bir textarea oluştur
    const textArea = document.createElement("textarea");
    textArea.value = message;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    // Mobil cihazda gösterme
    if (!isMobile()) {
        const copyNotification = document.getElementById("copyNotification");

        // Mesajı kopyalama bildirimi göster
        copyNotification.style.display = "block";  // Bildirimi görünür yap
        copyNotification.classList.add("show");

        // 2 saniye sonra bildirimi gizle
        setTimeout(() => {
            copyNotification.classList.remove("show"); // CSS class'ını kaldır
            copyNotification.style.display = "none";  // Bildirimi gizle
        }, 2000);  // 2 saniye sonra gizlensin
    }
}

// Mobil cihazı kontrol etme
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
}



messageForm.addEventListener("submit", (e) => {
    isSendingMessage = true;
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) {
        showErrorNotification("Boş mesaj gönderilemez!");
        return;
    }

    const messageData = {
        sender: currentUser,         // Gönderen bilgisi
        message: message,            // Mesaj metni
    };

    // Scroll to bottom
    scrollToBottom();

    // Mesajı WebSocket sunucusuna gönder
    ws.send(JSON.stringify(messageData));  // Mesaj JSON olarak gönder

    messageInput.value = ""; // Mesaj input alanını temizle

    // 1 saniyelik bekleme süresi ekle, bu sırada yeni mesaj bildirimi gösterme
    setTimeout(() => {
        isSendingMessage = false; // Mesaj gönderimi bitti, serbest bırak
    }, 1000); // 1 saniye sonra işlem tamamlanacak
});


// WebSocket mesaj alındığında
ws.onmessage = (event) => {
    const messageData = JSON.parse(event.data); // Gelen JSON verisi
    const message = messageData.message;
    const sender = messageData.sender;
    const timestampString = messageData.timestamp; // Direkt timestamp al

    const messageItem = document.createElement("li");
    messageItem.classList.add("message-item");

    // Mesaj içeriğini oluştur
    const messageContent = document.createElement("div");
    messageContent.classList.add("message-content");
    messageContent.textContent = message;

    // Gönderen bilgisi
    const messageSender = document.createElement("span");
    messageSender.classList.add("message-sender");
    messageSender.textContent = sender;
    messageSender.style.userSelect = 'none';  // Seçilemez
    messageSender.style.pointerEvents = 'none';  // Tıklanamaz

    // Tarih ve saat bilgisi ekle
    const timestamp = document.createElement("span");
    timestamp.classList.add("timestamp");
    timestamp.textContent = timestampString; // JSON'dan gelen timestamp'i kullan
    timestamp.style.userSelect = 'none';  // Seçilemez
    timestamp.style.pointerEvents = 'none';  // Tıklanamaz


    // Mesaj içeriklerine tarih ve IP adresini ekle
    messageItem.appendChild(messageContent);
    messageItem.appendChild(messageSender);
    messageItem.appendChild(timestamp); // Direkt string olarak eklenir

    messageList.appendChild(messageItem);

    // Kopyalama işlemi için etkinlik dinleyicisi
    messageItem.addEventListener("dblclick", () => {
        copyMessage(message); // Mesajı kopyala
    });

    // Yeni mesaj bildirimi ve otomatik kaydırma
    if (shouldAutoScroll) {
        if (checkScrollPosition()) {
            scrollToBottom();  // Son mesaj görünüyorsa en alta kaydır
        } else {
            showNewMessageNotification();  // Yeni mesaj bildirimi göster
        }
    }
};



// Check if the last message is visible
function checkScrollPosition() {
    const lastMessage = messageList.lastElementChild;

    if (lastMessage) {
        const lastMessageRect = lastMessage.getBoundingClientRect();
        const offset = 400; // A little margin before considering it fully visible // 2 kişide test ettim aşırı hayvan gibi spamlasa bile yeni mesaj bildiriim çıkmıyor ama
        // dezavantajı şu 7 tane falan mesaj altta kalırsa eğer o zaman yeni mesaj bildirimi veriyor aslında çok da mantıksız değil mantıklı gibi de hatta
        const isLastMessageVisible = lastMessageRect.top <= window.innerHeight + offset;

        return isLastMessageVisible;
    }

    return false;
}

// Scroll to the bottom of the message list
function scrollToBottom(offset = 0) {
    const lastMessage = messageList.lastElementChild;
    if (lastMessage) {
        const spacer = document.createElement("div");
        spacer.style.height = `${offset}px`;
        messageList.appendChild(spacer);

        lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
        setTimeout(() => spacer.remove(), 500);
    }
}


// Dark mode toggle
darkModeToggle.addEventListener("click", () => {
    body.classList.toggle("dark-mode");
    const mode = body.classList.contains("dark-mode") ? "enabled" : "disabled";
    localStorage.setItem("darkMode", mode);
});

// Message form submission

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();  // Enter'a basıldığında formu göndermeyi engeller
        messageForm.requestSubmit();  // Formu programatik olarak gönderir (submit() yerine)
    }
});


// Show error notification
function showErrorNotification(message) {
    errorNotification.textContent = message;
    errorNotification.style.display = "block";
    setTimeout(() => {
        errorNotification.style.display = "none";
    }, 2000);
}