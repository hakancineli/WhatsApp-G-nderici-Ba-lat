# WhatsApp Toplu Mesaj Sistemi - Deployment Rehberi

## 🚀 Canlı Deployment Seçenekleri

### 1. VPS/Sunucu Deployment (Önerilen)

#### A. DigitalOcean Droplet
```bash
# 1. Ubuntu 22.04 droplet oluştur (minimum $6/ay)
# 2. SSH ile bağlan
ssh root@your-server-ip

# 3. Node.js kurulumu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# 4. Chrome kurulumu
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# 5. Proje kurulumu
git clone https://github.com/hakancineli/WhatsApp-G-nderici-Ba-lat.git
cd WhatsApp-G-nderici-Ba-lat
npm install

# 6. PM2 ile çalıştırma
npm install -g pm2
pm2 start server/server.js --name whatsapp-sender
pm2 startup
pm2 save

# 7. Nginx reverse proxy (opsiyonel)
apt install nginx
# nginx konfigürasyonu ekle
```

#### B. AWS EC2
```bash
# 1. t3.micro instance oluştur (free tier)
# 2. Security Group: Port 3000 aç
# 3. Yukarıdaki adımları tekrarla
```

#### C. Hetzner Cloud (Ucuz)
```bash
# 1. €3.29/ay CX11 server
# 2. Ubuntu 22.04 seç
# 3. Yukarıdaki adımları tekrarla
```

### 2. Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-slim

# Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server/server.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  whatsapp-sender:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - HEADLESS=true
    restart: unless-stopped
```

### 3. Railway Deployment
```bash
# 1. Railway.app hesabı aç
# 2. GitHub repo bağla
# 3. Environment variables ekle:
#    - HEADLESS=true
#    - NODE_ENV=production
```

### 4. Render Deployment
```bash
# 1. Render.com hesabı aç
# 2. Web Service oluştur
# 3. Build Command: npm install
# 4. Start Command: node server/server.js
```

## 🔧 Production Konfigürasyonu

### Environment Variables
```bash
NODE_ENV=production
HEADLESS=true
PORT=3000
CHROME_BIN=/usr/bin/google-chrome-stable
```

### PM2 Ecosystem
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-sender',
    script: 'server/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      HEADLESS: 'true'
    }
  }]
}
```

## 🌐 Domain ve SSL

### Nginx Konfigürasyonu
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL (Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

## 📱 QR Kod Okutma Süreci

1. **Sunucu başlatıldığında** → QR kod oluşur
2. **Web arayüzüne git** → http://your-server:3000
3. **QR kodu telefonla tarat** → WhatsApp Web bağlantısı
4. **Session kaydedilir** → Bir daha QR gerekmiyor
5. **Mesaj göndermeye başla** → Sistem hazır

## 💡 Öneriler

### En Ucuz Seçenek: Hetzner Cloud
- **Fiyat:** €3.29/ay
- **Specs:** 1 vCPU, 2GB RAM, 20GB SSD
- **Lokasyon:** Almanya
- **Kurulum:** 5 dakika

### En Kolay Seçenek: Railway
- **Fiyat:** $5/ay (hobby plan)
- **Kurulum:** GitHub push ile otomatik
- **SSL:** Otomatik
- **Domain:** Ücretsiz subdomain

### En Güvenilir: AWS EC2
- **Fiyat:** ~$10/ay
- **Güvenilirlik:** %99.9 uptime
- **Ölçeklenebilirlik:** Yüksek
- **Destek:** 7/24

## 🔒 Güvenlik

```bash
# Firewall
ufw enable
ufw allow ssh
ufw allow 3000

# Fail2ban
apt install fail2ban

# Auto updates
apt install unattended-upgrades
```