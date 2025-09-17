# WhatsApp Toplu Mesaj Sistemi

Bu proje, WhatsApp üzerinden toplu mesaj göndermek için geliştirilmiş temiz ve optimize edilmiş bir sistemdir.

## Klasör Yapısı

```
whatsapp-temiz/
├── server/
│   └── server.js          # Ana sunucu dosyası
├── public/
│   ├── index.html         # Web arayüzü
│   ├── style.css          # Stil dosyası
│   └── script.js          # JavaScript dosyası
├── .wwebjs_auth/          # WhatsApp oturum bilgileri
├── node_modules/          # Bağımlılıklar
├── package.json           # Proje konfigürasyonu
├── package-lock.json      # Bağımlılık kilidi
├── whatsapp.db           # SQLite veritabanı
└── README.md             # Bu dosya
```

## Kurulum

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. Sunucuyu başlatın:
   ```bash
   # macOS (GUI Chrome ile):
   node server/server.js

   # Linux (sunucularda headless):
   HEADLESS=true node server/server.js
   ```

Linux sunucularda Chrome/Chromium otomatik indirilecektir (puppeteer). İsterseniz kendi Chrome yolunuzu `CHROME_BIN` ile geçebilirsiniz.

3. Tarayıcıda `http://localhost:3001` adresine gidin

## Özellikler

- ✅ Temiz ve optimize edilmiş kod yapısı
- ✅ Gereksiz dosyalardan arındırılmış
- ✅ WhatsApp Web API entegrasyonu
- ✅ Toplu mesaj gönderme
- ✅ Mesaj şablonları
- ✅ SQLite veritabanı desteği
- ✅ Web arayüzü

## API Endpoints

- `GET /api/qr` - QR kod al
- `GET /api/status` - Bağlantı durumu
- `POST /api/templates` - Mesaj şablonu kaydet
- `GET /api/templates` - Şablonları listele
- `POST /api/send-bulk` - Toplu mesaj gönder
- `GET /api/sent-messages` - Gönderilen mesajları listele

## Not

Bu klasör, gereksiz dosyalardan temizlenmiş ve sadece çalışan bileşenleri içeren optimize edilmiş versiyondur. 