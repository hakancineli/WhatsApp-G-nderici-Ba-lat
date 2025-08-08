const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Statik dosyaları her zaman doğru dizinden servis et
app.use(express.static(path.join(__dirname, '..', 'public')));

// SQLite veritabanı başlatma
const db = new sqlite3.Database('whatsapp.db');

// Veritabanı tablolarını oluştur
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS sent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// WhatsApp client
let client = null;
let qrCodeData = null;
let isConnected = false;
let isAuthenticated = false;

// Progress tracking
let currentSendingProgress = {
  current: 0,
  total: 0,
  successCount: 0,
  errorCount: 0,
  isActive: false
};

// WhatsApp client başlatma
function initializeWhatsApp() {
  console.log('initializeWhatsApp fonksiyonu çağrıldı');
  
  // Önceki client'ı temizle
  if (client) {
    try {
      client.destroy();
    } catch (e) {
      console.error('Önceki client destroy hatası:', e);
    }
  }
  
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'whatsapp-bulk-sender',
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      // WhatsApp Web'in çalışması için JS ve görsellerin etkin olması gerekir.
      // Stabil ve minimal bir argüman seti kullanıyoruz.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      timeout: 120000
    }
  });

  client.on('qr', async (qr) => {
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      console.log('QR kod oluşturuldu - Ana sayfadan taratın');
      isAuthenticated = false;
    } catch (err) {
      console.error('QR kod oluşturma hatası:', err);
    }
  });

  client.on('ready', () => {
    console.log('WhatsApp client hazır!');
    isConnected = true;
    isAuthenticated = true;
    qrCodeData = null; // QR kodu temizle çünkü artık gerekli değil
  });

  client.on('authenticated', () => {
    console.log('WhatsApp kimlik doğrulaması başarılı!');
    isAuthenticated = true;
  });

  client.on('disconnected', () => {
    console.log('WhatsApp bağlantısı kesildi');
    isConnected = false;
    qrCodeData = null; // QR kodunu sıfırla
    // Otomatik yeniden başlat
    setTimeout(() => {
      try {
        if (client) {
          client.destroy();
        }
      } catch (e) {
        console.error('Client destroy sırasında hata:', e);
      }
      initializeWhatsApp();
    }, 3000); // 3 saniye bekle
  });

  client.on('auth_failure', (msg) => {
    console.error('Kimlik doğrulama hatası:', msg);
  });

  client.on('error', (err) => {
    console.error('WhatsApp istemci hatası:', err);
    // Hata durumunda yeniden başlat
    setTimeout(() => {
      try {
        if (client) {
          client.destroy();
        }
      } catch (e) {
        console.error('Error handler destroy hatası:', e);
      }
      initializeWhatsApp();
    }, 5000);
  });

  client.on('change_state', (state) => {
    console.log('İstemci durumu değişti:', state);
  });

  client.initialize();
}

// API Routes

// QR kod al
app.get('/api/qr', (req, res) => {
  if (!client) {
    initializeWhatsApp();
  }
  
  if (isAuthenticated) {
    res.json({ qr: null, message: 'WhatsApp zaten bağlı!', authenticated: true });
  } else if (qrCodeData) {
    res.json({ qr: qrCodeData, message: 'QR kodu ana sayfadan taratın', authenticated: false });
  } else {
    res.json({ qr: null, message: 'QR kod henüz hazır değil', authenticated: false });
  }
});

// Bağlantı durumu
app.get('/api/status', (req, res) => {
  res.json({ 
    connected: isConnected, 
    authenticated: isAuthenticated,
    needsQR: !isAuthenticated && qrCodeData !== null
  });
});

// Progress durumu
app.get('/api/progress', (req, res) => {
  res.json(currentSendingProgress);
});

// Mesaj şablonu kaydet
app.post('/api/templates', (req, res) => {
  const { name, content } = req.body;
  
  if (!name || !content) {
    return res.status(400).json({ error: 'İsim ve içerik gerekli' });
  }

  db.run('INSERT INTO message_templates (name, content) VALUES (?, ?)', 
    [name, content], function(err) {
      if (err) {
        res.status(500).json({ error: 'Şablon kaydedilemedi' });
      } else {
        res.json({ id: this.lastID, name, content });
      }
    });
});

// Mesaj şablonlarını listele
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM message_templates ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Şablonlar alınamadı' });
    } else {
      res.json(rows);
    }
  });
});

// 30 gün içinde mesaj gönderilip gönderilmediğini kontrol et
function checkMessageSentInLast30Days(phoneNumber) {
  return new Promise((resolve, reject) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    db.get(
      'SELECT sent_at FROM sent_messages WHERE phone_number = ? AND sent_at > ? ORDER BY sent_at DESC LIMIT 1',
      [phoneNumber, thirtyDaysAgo.toISOString()],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.sent_at : null);
        }
      }
    );
  });
}

// Toplu kontrol fonksiyonu - daha hızlı
async function batchCheckNumbers(numbers) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return new Promise((resolve, reject) => {
    const placeholders = numbers.map(() => '?').join(',');
    const query = `
      SELECT phone_number, sent_at 
      FROM sent_messages 
      WHERE phone_number IN (${placeholders}) 
      AND sent_at > ? 
      ORDER BY sent_at DESC
    `;
    
    // İlk argüman SQL sorgusu olmalı, ikinci argüman parametreler
    db.all(query, [...numbers, thirtyDaysAgo.toISOString()], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const result = {};
        rows.forEach(row => {
          result[row.phone_number] = row.sent_at;
        });
        resolve(result);
      }
    });
  });
}

// Toplu mesaj gönder
app.post('/api/send-bulk', async (req, res) => {
  const { numbers, message, delay } = req.body;
  
  if (!isConnected) {
    return res.status(400).json({ error: 'WhatsApp bağlı değil' });
  }
  
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Geçerli numara listesi gerekli' });
  }
  
  if (!message) {
    return res.status(400).json({ error: 'Mesaj içeriği gerekli' });
  }

  // Progress'i başlat
  currentSendingProgress = {
    current: 0,
    total: numbers.length,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    isActive: true
  };

  const delayMs = (delay || 5) * 1000; // saniyeyi milisaniyeye çevir
  const results = [];
  const skippedNumbers = [];
  const validNumbers = [];

  // Önce tüm numaraları hızlıca kontrol et ve ayır
  console.log('Numaralar hızlıca kontrol ediliyor...');
  
  // Geçerli numaraları filtrele
  const validNumbersForCheck = [];
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i].replace(/\D/g, ''); // Sadece rakamları al
    
    // Numara formatını kontrol et
    if (number.length < 10) {
      results.push({ number: numbers[i], success: false, error: 'Geçersiz numara formatı' });
      currentSendingProgress.errorCount++;
      currentSendingProgress.current = i + 1;
      continue;
    }
    
    validNumbersForCheck.push(numbers[i]);
  }
  
  // Toplu kontrol yap
  let checkedNumbers = {};
  if (validNumbersForCheck.length > 0) {
    try {
      checkedNumbers = await batchCheckNumbers(validNumbersForCheck);
    } catch (error) {
      console.error('Toplu kontrol hatası:', error);
    }
  }
  
  // Sonuçları işle
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i].replace(/\D/g, '');
    
    if (number.length < 10) {
      continue; // Zaten işlendi
    }
    
    const lastSentDate = checkedNumbers[numbers[i]];
    
    if (lastSentDate) {
      // Son 30 gün içinde mesaj gönderilmiş, atla
      const skippedInfo = {
        number: numbers[i],
        lastSentDate: lastSentDate,
        reason: 'Son 30 gün içinde mesaj gönderilmiş'
      };
      skippedNumbers.push(skippedInfo);
      results.push({ 
        number: numbers[i], 
        success: false, 
        skipped: true, 
        error: `Son 30 gün içinde mesaj gönderilmiş (${new Date(lastSentDate).toLocaleDateString('tr-TR')})` 
      });
      currentSendingProgress.skippedCount++;
    } else {
      // Geçerli numara, gönderim listesine ekle
      validNumbers.push({
        index: i,
        number: numbers[i],
        formattedNumber: number.includes('@c.us') ? number : `${number}@c.us`
      });
    }
    
    currentSendingProgress.current = i + 1;
  }

  console.log(`Kontrol tamamlandı: ${validNumbers.length} geçerli numara, ${skippedNumbers.length} atlanan numara`);

  // Şimdi sadece geçerli numaralara mesaj gönder
  if (validNumbers.length > 0) {
    console.log(`Mesaj gönderimi başlıyor: ${validNumbers.length} numara`);
    
    for (let i = 0; i < validNumbers.length; i++) {
      const { index, number, formattedNumber } = validNumbers[i];
      
      try {
        // Mesaj gönder - timeout ile
        const sendPromise = client.sendMessage(formattedNumber, message);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Mesaj gönderimi zaman aşımı')), 30000)
        );
        
        await Promise.race([sendPromise, timeoutPromise]);
        
        // Gönderilen mesajı veritabanına kaydet
        db.run('INSERT INTO sent_messages (phone_number, message) VALUES (?, ?)', 
          [number, message], (err) => {
            if (err) {
              console.error('Veritabanı kayıt hatası:', err);
            }
          });
        
        results[index] = { number: number, success: true };
        currentSendingProgress.successCount++;
        
        console.log(`✅ Başarılı: ${number}`);
        
      } catch (error) {
        console.error(`❌ Hata (${number}):`, error.message);
        results[index] = { number: number, success: false, error: error.message };
        currentSendingProgress.errorCount++;
        
        // Hata durumunda kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Progress'i güncelle
      currentSendingProgress.current = numbers.length - validNumbers.length + i + 1;
      
      // Gecikme (son mesaj hariç)
      if (i < validNumbers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log(`Mesaj gönderimi tamamlandı: ${currentSendingProgress.successCount} başarılı, ${currentSendingProgress.errorCount} hata`);
  } else {
    console.log('Gönderilecek numara bulunamadı');
  }

  // Progress'i tamamla
  currentSendingProgress.isActive = false;

  res.json({ results, skippedNumbers });
});

// Gönderilen mesajları listele
app.get('/api/sent-messages', (req, res) => {
  db.all('SELECT * FROM sent_messages ORDER BY sent_at DESC LIMIT 100', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Gönderilen mesajlar alınamadı' });
    } else {
      res.json(rows);
    }
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  console.log('WhatsApp client başlatılıyor...');
  initializeWhatsApp();
}); 