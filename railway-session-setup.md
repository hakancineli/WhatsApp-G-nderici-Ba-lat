# 🚂 Railway Session Setup

## 🎯 Railway'de Session Kullanma

Railway gibi serverless platformlarda session dosyaları kalıcı değil. Çözüm:

### 1. Session'ı Base64'e Çevir
```bash
# Local'de session oluşturduktan sonra
tar -czf session.tar.gz .wwebjs_auth/
base64 session.tar.gz > session.base64
```

### 2. Environment Variable Olarak Ekle
```bash
# Railway dashboard'da environment variable ekle:
WHATSAPP_SESSION_BASE64="H4sIAAAAAAAAA+2da..."
```

### 3. Server.js'de Session'ı Restore Et
```javascript
// server/server.js başına ekle
const fs = require('fs');
const path = require('path');

// Session restore fonksiyonu
async function restoreSession() {
  const sessionBase64 = process.env.WHATSAPP_SESSION_BASE64;
  
  if (sessionBase64 && !fs.existsSync('.wwebjs_auth')) {
    console.log('🔄 Session restore ediliyor...');
    
    try {
      // Base64'ü decode et
      const sessionBuffer = Buffer.from(sessionBase64, 'base64');
      fs.writeFileSync('session.tar.gz', sessionBuffer);
      
      // Extract et
      const { execSync } = require('child_process');
      execSync('tar -xzf session.tar.gz');
      execSync('rm session.tar.gz');
      
      console.log('✅ Session başarıyla restore edildi');
    } catch (error) {
      console.error('❌ Session restore hatası:', error);
    }
  }
}

// WhatsApp client başlatmadan önce çağır
restoreSession().then(() => {
  initializeWhatsApp();
});
```

### 4. Otomatik Session Backup
```javascript
// Session'ı periyodik olarak backup al
setInterval(async () => {
  if (fs.existsSync('.wwebjs_auth')) {
    try {
      execSync('tar -czf session-backup.tar.gz .wwebjs_auth/');
      const backup = fs.readFileSync('session-backup.tar.gz');
      const base64 = backup.toString('base64');
      
      // Burada base64'ü external storage'a kaydet
      // (AWS S3, Google Drive, vs.)
      
      fs.unlinkSync('session-backup.tar.gz');
    } catch (error) {
      console.error('Backup hatası:', error);
    }
  }
}, 24 * 60 * 60 * 1000); // 24 saatte bir
```