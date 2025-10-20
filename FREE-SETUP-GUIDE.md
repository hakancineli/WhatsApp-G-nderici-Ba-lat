# 🆓 Ücretsiz Kurulum Rehberi

## 🎯 En Kolay: Render.com

### Adım 1: Session Hazırla
```bash
# Local'de QR oku
node server/server.js
# QR tarat, "WhatsApp client hazır!" bekle
# Ctrl+C ile durdur

# Session'ı base64'e çevir
tar -czf session.tar.gz .wwebjs_auth/ whatsapp.db
base64 session.tar.gz > session.base64
```

### Adım 2: Render'da Deploy
1. **render.com** git → Sign up (GitHub ile)
2. **"New Web Service"** tıkla
3. **GitHub repo'yu seç:** `WhatsApp-G-nderici-Ba-lat`
4. **Ayarlar:**
   - Name: `whatsapp-sender`
   - Build Command: `npm install`
   - Start Command: `node server/server.js`
5. **Environment Variables:**
   ```
   NODE_ENV = production
   HEADLESS = true
   WHATSAPP_SESSION_BASE64 = [session.base64 içeriği]
   ```
6. **"Create Web Service"** tıkla

### Adım 3: Çalıştır
- Deploy tamamlanınca URL verilir
- QR okutmaya gerek yok!
- Direkt mesaj gönderebilirsin 🚀

## 🔄 Alternatif: Cyclic.sh

### Kurulum:
1. **cyclic.sh** git
2. **"Deploy Now"** → GitHub repo seç
3. Environment variables ekle
4. Otomatik deploy olur

## ⚡ Hızlı Test: Glitch

### Kurulum:
1. **glitch.com** git
2. **"Import from GitHub"**
3. Repo URL'sini yapıştır
4. Environment variables ekle
5. Anında çalışır!

## 💡 Önemli Notlar

### Sleep Problemi Çözümü:
```javascript
// server.js'e ekle (keep-alive)
setInterval(() => {
  console.log('🔄 Keep alive ping');
}, 14 * 60 * 1000); // 14 dakikada bir
```

### UptimeRobot ile Uyanık Tutma:
1. **uptimerobot.com** hesabı aç
2. Monitor ekle → URL'ini gir
3. 5 dakikada bir ping atar
4. Sleep olmaz!

## 🎯 Tavsiye Sıralaması:

1. **Render** - En stabil, kolay setup
2. **Cyclic** - En hızlı deploy
3. **Glitch** - En basit, online editor
4. **Fly.io** - En güçlü, global
5. **Railway** - $5 kredi ile başlar

Hepsi tamamen ücretsiz! 🎉