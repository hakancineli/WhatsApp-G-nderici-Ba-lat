#!/bin/bash

echo "🔄 WhatsApp Session Transfer Script"
echo "=================================="

# Konfigürasyon
SERVER_USER="root"
SERVER_HOST=""
SERVER_PATH="/root/WhatsApp-G-nderici-Ba-lat"
SESSION_FILE="whatsapp-session.tar.gz"

# Sunucu bilgilerini al
if [ -z "$SERVER_HOST" ]; then
    read -p "Sunucu IP adresi: " SERVER_HOST
fi

if [ -z "$SERVER_USER" ]; then
    read -p "Sunucu kullanıcı adı (default: root): " SERVER_USER
    SERVER_USER=${SERVER_USER:-root}
fi

echo ""
echo "📦 Session dosyaları hazırlanıyor..."

# Session dosyalarının varlığını kontrol et
if [ ! -d ".wwebjs_auth" ]; then
    echo "❌ .wwebjs_auth klasörü bulunamadı!"
    echo "Önce local'de QR okutup session oluşturun:"
    echo "node server/server.js"
    exit 1
fi

# Session dosyalarını sıkıştır
echo "📁 Session dosyaları sıkıştırılıyor..."
tar -czf $SESSION_FILE .wwebjs_auth/ whatsapp.db 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Session dosyaları hazırlandı: $SESSION_FILE"
else
    echo "❌ Session dosyaları sıkıştırılamadı!"
    exit 1
fi

# Dosya boyutunu göster
SIZE=$(du -h $SESSION_FILE | cut -f1)
echo "📊 Dosya boyutu: $SIZE"

echo ""
echo "🚀 Sunucuya yükleniyor..."

# Sunucuya yükle
scp $SESSION_FILE $SERVER_USER@$SERVER_HOST:$SERVER_PATH/

if [ $? -eq 0 ]; then
    echo "✅ Dosya sunucuya yüklendi"
else
    echo "❌ Dosya yüklenemedi!"
    exit 1
fi

echo ""
echo "📂 Sunucuda extract ediliyor..."

# Sunucuda extract et
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PATH && tar -xzf $SESSION_FILE && rm $SESSION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Session dosyaları sunucuda hazırlandı"
else
    echo "❌ Extract işlemi başarısız!"
    exit 1
fi

# Local dosyayı temizle
rm $SESSION_FILE

echo ""
echo "🎉 Transfer tamamlandı!"
echo ""
echo "Sunucuda çalıştırmak için:"
echo "ssh $SERVER_USER@$SERVER_HOST"
echo "cd $SERVER_PATH"
echo "NODE_ENV=production HEADLESS=true node server/server.js"
echo ""
echo "QR okutmaya gerek yok! Direkt çalışacak 🚀"