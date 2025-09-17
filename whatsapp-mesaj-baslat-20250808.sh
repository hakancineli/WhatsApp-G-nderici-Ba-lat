#!/bin/zsh

echo "WhatsApp Toplu Mesaj Gönderici başlatılıyor..."

# Proje dizinine git
cd "/Users/hakancineli/whatsapp-temiz"

# Port 3000'i kullanan eski process'leri durdur
echo "Eski process'ler kontrol ediliyor..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null

# 2 saniye bekle
sleep 2

# Node.js sürümünü kontrol et
echo "Node.js sürümü kontrol ediliyor..."
/opt/homebrew/opt/node@18/bin/node --version

# Sunucuyu başlat
echo "Sunucu başlatılıyor..."
echo "Yeni özellikler:"
echo "✅ Canlı progress tracking"
echo "✅ Gerçek zamanlı başarılı/başarısız sayıları"
echo "✅ Otomatik error handling"
echo ""

/opt/homebrew/opt/node@18/bin/node server/server.js
