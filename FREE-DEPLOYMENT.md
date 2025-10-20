# 🆓 Ücretsiz Deployment Seçenekleri

## 🎯 Tamamen Ücretsiz Platformlar

### 1. **Render (Önerilen)**
- **Ücretsiz Plan:** 750 saat/ay
- **RAM:** 512MB
- **Sleep:** 15 dakika inaktivite sonrası
- **Custom Domain:** Ücretsiz
- **SSL:** Otomatik

#### Kurulum:
```bash
# 1. render.com hesabı aç
# 2. "New Web Service" → GitHub repo bağla
# 3. Build Command: npm install
# 4. Start Command: node server/server.js
# 5. Environment Variables:
NODE_ENV=production
HEADLESS=true
WHATSAPP_SESSION_BASE64=[session base64]
```

### 2. **Railway (Free Tier)**
- **Ücretsiz Plan:** $5 kredi/ay
- **RAM:** 512MB  
- **Sleep:** Yok
- **Custom Domain:** Ücretsiz

#### Kurulum:
```bash
# 1. railway.app hesabı aç
# 2. GitHub repo deploy et
# 3. Environment variables ekle
```

### 3. **Fly.io**
- **Ücretsiz Plan:** 3 micro VM
- **RAM:** 256MB
- **Sleep:** Yok
- **Lokasyon:** Global

#### Kurulum:
```bash
# 1. fly.io hesabı aç
# 2. flyctl install et
flyctl auth login
flyctl launch
flyctl deploy
```

### 4. **Cyclic**
- **Ücretsiz Plan:** Sınırsız
- **RAM:** 1GB
- **Sleep:** 30 dakika sonrası
- **Özellik:** Çok kolay setup

#### Kurulum:
```bash
# 1. cyclic.sh hesabı aç
# 2. GitHub repo bağla
# 3. Otomatik deploy
```

### 5. **Glitch**
- **Ücretsiz Plan:** Sınırsız
- **RAM:** 512MB
- **Sleep:** 5 dakika sonrası
- **Özellik:** Online editor

#### Kurulum:
```bash
# 1. glitch.com hesabı aç
# 2. "Import from GitHub"
# 3. Otomatik çalışır
```

## 🔧 Fly.io için Özel Konfigürasyon