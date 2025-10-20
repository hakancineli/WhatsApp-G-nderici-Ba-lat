


const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// Statik dosyaları her zaman doğru dizinden servis et
app.use(express.static(path.join(__dirname, '..', 'public')));

// Hata yakalama middleware
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON Parse Error:', error.message);
    return res.status(400).json({ error: 'Geçersiz JSON formatı' });
  }
  if (error.type === 'entity.too.large') {
    console.error('Payload too large:', error.message);
    return res.status(413).json({ error: 'Dosya çok büyük. Maksimum 50MB.' });
  }
  next();
});

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
  isActive: false,
  isPaused: false,
  isStopped: false
};

// Send control state
const sendControlState = {
  isPaused: false,
  isStopped: false,
  reason: null,
  updatedAt: null
};

// Auto pause config/state
const autoPauseConfig = {
  enabled: true,
  durationMs: 30 * 1000 // 30 saniye
};
let autoPauseTimer = null;

// WhatsApp client başlatma
async function initializeWhatsApp() {
  console.log('🚀 WhatsApp client başlatılıyor...');
  console.log('🔧 Chrome konfigürasyonu yükleniyor...');
  
  // Önceki client'ı temizle
  if (client) {
    try {
      console.log('🔄 Önceki client temizleniyor...');
      await client.destroy();
      console.log('✅ Önceki client temizlendi');
    } catch (e) {
      console.error('❌ Önceki client destroy hatası:', e);
    }
  }
  
  console.log('🔧 Chrome ayarları yapılandırılıyor...');
  console.log('📁 Chrome data dizini:', path.join(__dirname, '..', '.chrome-data'));
  // Ortama göre Chrome yolu ve headless modu belirle
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  const chromeExecutable = process.env.CHROME_BIN || (isMac ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
  const headlessMode = process.env.HEADLESS ? process.env.HEADLESS === 'true' : isLinux;

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'whatsapp-bulk-sender',
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: headlessMode,
        executablePath: chromeExecutable,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--user-data-dir=' + path.join(__dirname, '..', '.chrome-data'),
          '--profile-directory=WhatsApp-Bot',
          '--remote-debugging-port=9223',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--disable-logging',
          '--silent',
          '--log-level=3',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor'
        ]
      }
  });
  console.log('✅ Chrome ayarları tamamlandı');

  client.on('qr', async (qr) => {
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      console.log('📱 QR kod oluşturuldu!');
      console.log('🌐 Ana sayfadan (http://localhost:3000) QR kodu taratın');
      isAuthenticated = false;
    } catch (err) {
      console.error('❌ QR kod oluşturma hatası:', err);
    }
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp client hazır!');
    console.log('🎉 QR kod tarama başarılı!');
    isConnected = true;
    isAuthenticated = true;
    qrCodeData = null; // QR kodu temizle çünkü artık gerekli değil
  });

  client.on('authenticated', () => {
    console.log('🔐 WhatsApp kimlik doğrulaması başarılı!');
    isAuthenticated = true;
  });

  client.on('disconnected', () => {
    console.log('❌ WhatsApp bağlantısı kesildi');
    isConnected = false;
    qrCodeData = null; // QR kodunu sıfırla
    // Otomatik yeniden başlat
    console.log('⏳ 3 saniye sonra yeniden bağlanılıyor...');
    setTimeout(async () => {
      try {
        if (client) {
          await client.destroy();
        }
      } catch (e) {
        console.error('❌ Client destroy sırasında hata:', e);
      }
      console.log('🔄 WhatsApp client yeniden başlatılıyor...');
      initializeWhatsApp();
    }, 3000); // 3 saniye bekle
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Kimlik doğrulama hatası:', msg);
  });

  client.on('error', (err) => {
    console.error('❌ WhatsApp istemci hatası:', err);
    // Hata durumunda yeniden başlat
    console.log('⏳ 5 saniye sonra yeniden başlatılıyor...');
    setTimeout(async () => {
      try {
        if (client) {
          await client.destroy();
        }
      } catch (e) {
        console.error('❌ Error handler destroy hatası:', e);
      }
      console.log('🔄 WhatsApp client yeniden başlatılıyor...');
      initializeWhatsApp();
    }, 5000);
  });

  client.on('change_state', (state) => {
    console.log('🔄 İstemci durumu değişti:', state);
  });
  
  client.on('loading_screen', (percent, message) => {
    console.log(`📱 Yükleniyor: ${percent}% - ${message}`);
  });

  // Gelen mesajları dinle ve otomatik duraklat
  client.on('message', async (message) => {
    try {
      // Sadece bize gelen (bizden olmayan) mesajlarda çalış
      if (message.fromMe) return;
      if (!autoPauseConfig.enabled) return;
      
      // Sadece aktif gönderim varsa kontrol et
      if (!currentSendingProgress.isActive) return;

      // Mesajın kendi numaramıza mı geldiğini kontrol et
      const chat = await message.getChat();
      const contact = await message.getContact();
      
      // Eğer mesaj grup sohbetinden geliyorsa duraklatma
      if (chat.isGroup) {
        console.log('📱 Grup mesajı algılandı, duraklatma yapılmıyor');
        return;
      }
      
      // Eğer mesaj broadcast listesinden geliyorsa duraklatma  
      if (chat.isBroadcast) {
        console.log('📱 Broadcast mesajı algılandı, duraklatma yapılmıyor');
        return;
      }
      
      // Sadece bireysel sohbetlerde (kişisel mesajlarda) duraklat
      console.log('📱 Kişisel mesaj algılandı:', contact.number || contact.id.user);

      // Otomatik duraklatmayı tetikle
      if (!sendControlState.isPaused && !sendControlState.isStopped) {
        sendControlState.isPaused = true;
        sendControlState.reason = 'auto-pause:inbound-message';
        sendControlState.updatedAt = new Date().toISOString();
        currentSendingProgress.isPaused = true;
        console.warn('⏸️ Kişisel mesaj algılandı, gönderim otomatik olarak duraklatıldı');
      }

      // Varsa önceki zamanlayıcıyı temizle ve yeniden başlat
      if (autoPauseTimer) clearTimeout(autoPauseTimer);
      autoPauseTimer = setTimeout(() => {
        sendControlState.isPaused = false;
        sendControlState.reason = null;
        sendControlState.updatedAt = new Date().toISOString();
        currentSendingProgress.isPaused = false;
        console.log('▶️ Otomatik duraklatma süresi doldu, gönderim devam edebilir');
      }, autoPauseConfig.durationMs);
    } catch (e) {
      console.error('Otomatik duraklatma hata:', e);
    }
  });
  
  console.log('🚀 Chrome başlatılıyor...');
  console.log('⏳ Bu işlem birkaç saniye sürebilir...');
  console.log('🔧 Chrome ayarları:');
  console.log('   - Single process mode: Aktif');
  console.log('   - No sandbox: Aktif');
  console.log('   - GPU disabled: Aktif');
  console.log('   - Extensions disabled: Aktif');
  console.log('   - User data dir: .chrome-data');
  console.log('   - Chrome executable:', chromeExecutable || 'puppeteer default');
  console.log('   - Total args: ' + client.options.puppeteer.args.length);
  console.log('📊 Chrome argümanları yüklendi');
  console.log('🎯 Chrome başlatılıyor...');
  console.log('⏳ Chrome başlatılıyor, lütfen bekleyin...');
  try {
    await client.initialize();
    console.log('✅ Chrome başarıyla başlatıldı');
  } catch (error) {
    console.error('❌ WhatsApp client başlatma hatası:', error);
    console.error('🔍 Hata detayı:', error.message);
    
    // Chrome process'lerini temizle ve yeniden dene
    console.log('🔄 Chrome process\'leri temizleniyor...');
    try {
      const { exec } = require('child_process');
      exec('pkill -f "chrome-whatsapp" && pkill -f "Google Chrome"', (err) => {
        if (err) console.log('❌ Chrome temizleme hatası:', err);
        else console.log('✅ Chrome process\'leri temizlendi');
      });
      
      // Chrome lock dosyalarını da temizle
      exec('rm -rf /tmp/chrome-whatsapp /private/tmp/chrome-whatsapp', (err) => {
        if (err) console.log('❌ Lock dosya temizleme hatası:', err);
        else console.log('✅ Chrome lock dosya temizlendi');
      });
      
      // Proje dizinindeki Chrome data'yı da temizle
      exec('rm -rf .chrome-data', (err) => {
        if (err) console.log('❌ Proje Chrome data temizleme hatası:', err);
        else console.log('✅ Proje Chrome data temizlendi');
      });
      
      // Chrome'un tüm instance'larını zorla kapat
      exec('pkill -9 -f "Google Chrome"', (err) => {
        if (err) console.log('❌ Chrome zorla kapatma hatası:', err);
        else console.log('✅ Chrome zorla kapatıldı');
      });
      
      console.log('✅ Chrome temizliği tamamlandı');
    } catch (e) {
      console.log('❌ Process temizleme hatası:', e);
    }
    
    // 5 saniye bekle ve yeniden dene
    console.log('⏳ 5 saniye sonra yeniden deneniyor...');
    console.log('🔄 WhatsApp client yeniden başlatılıyor...');
    console.log('🔄 Yeniden başlatma zamanlayıcısı ayarlandı');
    console.log('⏳ 5 saniye bekleniyor...');
    console.log('🔄 Zamanlayıcı başlatıldı...');
    console.log('🔄 Zamanlayıcı çalışıyor...');
    console.log('🔄 Zamanlayıcı aktif...');
    console.log('🔄 Zamanlayıcı hazır...');
    console.log('🔄 Zamanlayıcı başlatıldı...');
    console.log('🔄 Zamanlayıcı çalışıyor...');
    console.log('🔄 Zamanlayıcı aktif...');
    console.log('🔄 Zamanlayıcı hazır...');
    console.log('🔄 Zamanlayıcı başlatıldı...');
    console.log('🔄 Zamanlayıcı çalışıyor...');
    console.log('🔄 Zamanlayıcı aktif...');
    console.log('🔄 Zamanlayıcı hazır...');
    setTimeout(() => {
      console.log('🔄 Yeniden başlatma zamanlayıcısı tetiklendi');
      initializeWhatsApp();
    }, 5000);
  }
}

// API Routes

// QR kod al
app.get('/api/qr', async (req, res) => {
  if (!client) {
    await initializeWhatsApp();
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
    // Auth olmuşsa da bağlı kabul et
    connected: isConnected || isAuthenticated, 
    authenticated: isAuthenticated,
    needsQR: !isAuthenticated && qrCodeData !== null
  });
});

// Progress durumu
app.get('/api/progress', (req, res) => {
  res.json(currentSendingProgress);
});

// Control endpoints: pause/resume/stop/status
app.get('/api/control/status', (req, res) => {
  res.json({
    ...sendControlState,
    progress: currentSendingProgress,
    autoPause: autoPauseConfig
  });
});

app.post('/api/control/pause', (req, res) => {
  const { reason } = req.body || {};
  sendControlState.isPaused = true;
  sendControlState.isStopped = false;
  sendControlState.reason = reason || 'manual-pause';
  sendControlState.updatedAt = new Date().toISOString();
  currentSendingProgress.isPaused = true;
  currentSendingProgress.isStopped = false;
  res.json({ ok: true, ...sendControlState });
});

app.post('/api/control/resume', (req, res) => {
  sendControlState.isPaused = false;
  sendControlState.reason = null;
  sendControlState.updatedAt = new Date().toISOString();
  currentSendingProgress.isPaused = false;
  res.json({ ok: true, ...sendControlState });
});

app.post('/api/control/stop', (req, res) => {
  const { reason } = req.body || {};
  sendControlState.isStopped = true;
  sendControlState.isPaused = false;
  sendControlState.reason = reason || 'manual-stop';
  sendControlState.updatedAt = new Date().toISOString();
  currentSendingProgress.isStopped = true;
  currentSendingProgress.isPaused = false;
  res.json({ ok: true, ...sendControlState });
});

// Auto-pause ayarlarını al/güncelle
app.get('/api/control/auto-pause', (req, res) => {
  res.json(autoPauseConfig);
});

app.post('/api/control/auto-pause', (req, res) => {
  const { enabled, durationMs } = req.body || {};
  if (typeof enabled === 'boolean') autoPauseConfig.enabled = enabled;
  if (Number.isFinite(durationMs) && durationMs >= 0) autoPauseConfig.durationMs = durationMs;
  res.json({ ok: true, autoPause: autoPauseConfig });
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
  const { numbers, message, delay, image, templateMode, selectedTemplates } = req.body;
  
  if (!(isConnected || isAuthenticated)) {
    return res.status(400).json({ error: 'WhatsApp bağlı değil' });
  }
  
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Geçerli numara listesi gerekli' });
  }
  
  // Çoklu şablon modunda kontrol
  if (templateMode === 'multiple') {
    if (!selectedTemplates || selectedTemplates.length === 0) {
      return res.status(400).json({ error: 'Çoklu şablon modunda en az bir şablon seçmelisiniz' });
    }
  } else {
    if (!message) {
      return res.status(400).json({ error: 'Mesaj içeriği gerekli' });
    }
  }

  // Mesaj uzunluğu kontrolü
  if (image && message.length > 1024) {
    return res.status(400).json({ error: 'Görsel ile birlikte gönderilen mesajlar maksimum 1024 karakter olabilir' });
  }
  
  if (!image && message.length > 4096) {
    console.warn(`⚠️ Uzun mesaj uyarısı: ${message.length} karakter`);
  }

  // Progress'i başlat
  currentSendingProgress = {
    current: 0,
    total: numbers.length,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    isActive: true,
    isPaused: false,
    isStopped: false
  };

  // Yeni iş başlarken durdurma/duraklatma bayraklarını sıfırla
  sendControlState.isStopped = false;
  sendControlState.isPaused = false;
  sendControlState.reason = null;
  sendControlState.updatedAt = new Date().toISOString();

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
    
    const lastSentDate = null; // 30 günlük kısıtlama geçici devre dışı
    // const lastSentDate = checkedNumbers[numbers[i]];
    
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

  // Çoklu şablon modunda şablonları getir
  let templateContents = [];
  if (templateMode === 'multiple') {
    if (!selectedTemplates || selectedTemplates.length === 0) {
      return res.status(400).json({ error: 'Çoklu şablon modunda şablon seçilmemiş' });
    }
    
    try {
      const placeholders = selectedTemplates.map(() => '?').join(',');
      const templateQuery = `SELECT * FROM message_templates WHERE id IN (${placeholders})`;
      
      const templateRows = await new Promise((resolve, reject) => {
        db.all(templateQuery, selectedTemplates, (err, rows) => {
          if (err) {
            console.error('Veritabanı hatası:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      
      templateContents = templateRows.map(row => row.content);
      console.log(`${templateContents.length} şablon yüklendi (spam koruması aktif)`);
      
      if (templateContents.length === 0) {
        return res.status(400).json({ error: 'Seçilen şablonlar bulunamadı' });
      }
    } catch (error) {
      console.error('Şablon yükleme hatası:', error);
      return res.status(500).json({ error: 'Şablonlar yüklenemedi: ' + error.message });
    }
  }

  // Şimdi sadece geçerli numaralara mesaj gönder
  if (validNumbers.length > 0) {
    console.log(`Mesaj gönderimi başlıyor: ${validNumbers.length} numara`);
    
    for (let i = 0; i < validNumbers.length; i++) {
      // Durdurulmuşsa işi bitir
      if (sendControlState.isStopped) {
        console.warn('⛔ Gönderim kullanıcı tarafından DURDURULDU');
        currentSendingProgress.isStopped = true;
        break;
      }

      // Duraklatılmışsa devam edene kadar bekle
      while (sendControlState.isPaused && !sendControlState.isStopped) {
        currentSendingProgress.isPaused = true;
        await new Promise(r => setTimeout(r, 1000));
      }
      currentSendingProgress.isPaused = false;
      const { index, number } = validNumbers[i];
      
      // Çoklu şablon modunda mesajı belirle
      let currentMessage = message;
      if (templateMode === 'multiple' && templateContents.length > 0) {
        const templateIndex = i % templateContents.length;
        currentMessage = templateContents[templateIndex];
        console.log(`📝 Şablon ${templateIndex + 1}/${templateContents.length} kullanılıyor: ${number}`);
      }
      
      try {
        // Önce numaranın WhatsApp'ta kayıtlı olup olmadığını kontrol et
        const onlyDigits = number.replace(/\D/g, '');
        const jidInfo = await client.getNumberId(onlyDigits);
        if (!jidInfo) {
          results[index] = { number: number, success: false, error: 'Numara WhatsApp kullanmıyor' };
          currentSendingProgress.errorCount++;
          console.warn(`⚠️ WhatsApp kaydı yok: ${number}`);
          currentSendingProgress.current = numbers.length - validNumbers.length + i + 1;
          continue;
        }

        const chatId = jidInfo._serialized; // örn: 90555...@c.us

        // Mesaj gönder - timeout ile
        let sendPromise;
        
        if (image && image.data) {
          // Görsel ile mesaj gönder
          const base64Data = image.data.split(',')[1]; // data:image/jpeg;base64, kısmını kaldır
          const media = new MessageMedia(image.type, base64Data, image.name || 'image.jpg');
          sendPromise = client.sendMessage(chatId, media, { caption: currentMessage });
        } else {
          // Sadece metin mesajı gönder
          sendPromise = client.sendMessage(chatId, currentMessage);
        }
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Mesaj gönderimi zaman aşımı')), 30000)
        );
        
        // Durdurma/pause kontrolü gönderim sırasında da etkili olmaz; bu nedenle sadece race bekliyoruz
        await Promise.race([sendPromise, timeoutPromise]);
        
        // Gönderilen mesajı veritabanına kaydet
        db.run('INSERT INTO sent_messages (phone_number, message) VALUES (?, ?)', 
          [number, currentMessage], (err) => {
            if (err) {
              console.error('Veritabanı kayıt hatası:', err);
            }
          });
        
        results[index] = { number: number, success: true };
        currentSendingProgress.successCount++;
        
        console.log(`✅ Başarılı: ${number}`);
        
      } catch (error) {
        let errMsg = error?.message || String(error);
        console.error(`❌ Hata (${number}):`, errMsg);

        // Oturum/sayfa kapanması durumunda bir kez daha dene
        const isTransient = /Target closed|Session closed|Execution context|Node is detached/i.test(errMsg);
        if (isTransient) {
          console.warn('⚠️ Geçici hata algılandı, 5 sn bekleyip yeniden denenecek...');
          await new Promise(r => setTimeout(r, 5000));
          try {
            // Hazır olana kadar bekle (state alınabiliyorsa READY say)
            try { await client.getState(); } catch {}
            
            let retryPromise;
            if (image && image.data) {
              const base64Data = image.data.split(',')[1];
              const media = new MessageMedia(image.type, base64Data, image.name || 'image.jpg');
              retryPromise = client.sendMessage(jidInfo?._serialized || chatId, media, { caption: currentMessage });
            } else {
              retryPromise = client.sendMessage(jidInfo?._serialized || chatId, currentMessage);
            }
            
            const retryTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Mesaj gönderimi zaman aşımı (retry)')), 30000));
            await Promise.race([retryPromise, retryTimeout]);
            // Başarılı retry
            db.run('INSERT INTO sent_messages (phone_number, message) VALUES (?, ?)', 
              [number, currentMessage], (err) => { if (err) console.error('Veritabanı kayıt hatası:', err); });
            results[index] = { number: number, success: true };
            currentSendingProgress.successCount++;
            console.log(`✅ Başarılı (yeniden deneme): ${number}`);
          } catch (retryErr) {
            errMsg = retryErr?.message || String(retryErr);
            results[index] = { number: number, success: false, error: errMsg };
            currentSendingProgress.errorCount++;
          }
        } else {
          results[index] = { number: number, success: false, error: errMsg };
          currentSendingProgress.errorCount++;
        }

        // Hata durumunda kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Progress'i güncelle
      currentSendingProgress.current = numbers.length - validNumbers.length + i + 1;
      
      // Gecikme (son mesaj hariç) — gecikme sırasında da pause/stop kontrolü yap
      if (i < validNumbers.length - 1) {
        const step = 250;
        let waited = 0;
        while (waited < delayMs) {
          if (sendControlState.isStopped) {
            console.warn('⛔ Gönderim DURDURULDU (gecikme esnasında)');
            currentSendingProgress.isStopped = true;
            break;
          }
          while (sendControlState.isPaused && !sendControlState.isStopped) {
            currentSendingProgress.isPaused = true;
            await new Promise(r => setTimeout(r, 500));
          }
          currentSendingProgress.isPaused = false;
          if (sendControlState.isStopped) break;
          const remain = delayMs - waited;
          const chunk = remain < step ? remain : step;
          await new Promise(r => setTimeout(r, chunk));
          waited += chunk;
        }
        if (sendControlState.isStopped) {
          break;
        }
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

// Process exit handler ekle
process.on('SIGINT', async () => {
  console.log('\n🔄 Uygulama kapatılıyor...');
  if (client) {
    try {
      await client.destroy();
      console.log('✅ WhatsApp client kapatıldı');
    } catch (e) {
      console.error('❌ Client kapatma hatası:', e);
    }
  }
  console.log('👋 Uygulama güvenli şekilde kapatıldı');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Uygulama kapatılıyor...');
  if (client) {
    try {
      await client.destroy();
      console.log('✅ WhatsApp client kapatıldı');
    } catch (e) {
      console.error('❌ Client kapatma hatası:', e);
    }
  }
  console.log('👋 Uygulama güvenli şekilde kapatıldı');
  process.exit(0);
});

// Sunucuyu başlat
app.listen(PORT, async () => {
  console.log(`🌐 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  console.log('📱 WhatsApp client başlatılıyor...');
  await initializeWhatsApp();
}); 