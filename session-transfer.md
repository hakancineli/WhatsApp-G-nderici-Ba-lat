# 📱 WhatsApp Session Transfer Rehberi

## 🎯 Amaç
Local makinede QR okutup session bilgilerini canlı sunucuya aktarmak

## 📂 Session Dosyaları
WhatsApp session bilgileri şu klasörlerde saklanır:
- `.wwebjs_auth/` - WhatsApp Web session
- `.chrome-data/` - Chrome profil bilgileri
- `whatsapp.db` - SQLite veritabanı

## 🔄 Transfer Süreci

### 1. Local'de Session Oluştur
```bash
# Local makinede çalıştır
node server/server.js

# http://localhost:3000 git
# QR kodu tarat
# "WhatsApp client hazır!" mesajını bekle
# Ctrl+C ile durdur
```

### 2. Session Dosyalarını Sıkıştır
```bash
# Session dosyalarını zip'le
tar -czf whatsapp-session.tar.gz .wwebjs_auth/ whatsapp.db

# Veya sadece gerekli dosyalar
zip -r whatsapp-session.zip .wwebjs_auth/ whatsapp.db
```

### 3. Sunucuya Yükle
```bash
# SCP ile transfer
scp whatsapp-session.tar.gz user@your-server:/path/to/project/

# Sunucuda extract et
ssh user@your-server
cd /path/to/project
tar -xzf whatsapp-session.tar.gz
```

### 4. Sunucuda Çalıştır
```bash
# Sunucuda başlat
NODE_ENV=production HEADLESS=true node server/server.js

# QR okutmaya gerek yok! Direkt çalışır
```

## 🚀 Otomatik Transfer Script'i