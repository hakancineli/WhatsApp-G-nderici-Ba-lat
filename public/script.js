// DOM elementleri
const elements = {
    qrCode: document.getElementById('qr-code'),
    connectionStatus: document.getElementById('connection-status'),
    refreshQr: document.getElementById('refresh-qr'),
    phoneNumbers: document.getElementById('phone-numbers'),
    numberCount: document.getElementById('number-count'),
    clearNumbers: document.getElementById('clear-numbers'),
    loadExample: document.getElementById('load-example'),
    templateSelect: document.getElementById('template-select'),
    saveTemplate: document.getElementById('save-template'),
    messageContent: document.getElementById('message-content'),
    messageLength: document.getElementById('message-length'),
    templateSaveForm: document.getElementById('template-save-form'),
    templateName: document.getElementById('template-name'),
    confirmSaveTemplate: document.getElementById('confirm-save-template'),
    cancelSaveTemplate: document.getElementById('cancel-save-template'),
    delayInput: document.getElementById('delay-input'),
    previewMode: document.getElementById('preview-mode'),
    startSending: document.getElementById('start-sending'),
    sendingStatus: document.getElementById('sending-status'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    progressPercentage: document.getElementById('progress-percentage'),
    successCount: document.getElementById('success-count'),
    errorCount: document.getElementById('error-count'),
    skippedCount: document.getElementById('skipped-count'),
    stopSending: document.getElementById('stop-sending'),
    pauseSending: document.getElementById('pause-sending'),
    resumeSending: document.getElementById('resume-sending'),
    autoResumeInfo: document.getElementById('auto-resume-info'),
    countdownTimer: document.getElementById('countdown-timer'),
    imageUpload: document.getElementById('image-upload'),
    imagePreview: document.getElementById('image-preview'),
    previewImg: document.getElementById('preview-img'),
    removeImage: document.getElementById('remove-image'),
    loadSampleImage: document.getElementById('load-sample-image'),
    singleTemplateMode: document.getElementById('single-template-mode'),
    multipleTemplateMode: document.getElementById('multiple-template-mode'),
    templateCheckboxList: document.getElementById('template-checkbox-list'),
    selectAllTemplates: document.getElementById('select-all-templates'),
    selectedTemplatesCount: document.getElementById('selected-templates-count'),
    sentMessagesList: document.getElementById('sent-messages-list'),
    refreshSent: document.getElementById('refresh-sent'),
    skippedNumbers: document.getElementById('skipped-numbers'),
    skippedNumbersList: document.getElementById('skipped-numbers-list'),
    totalSkipped: document.getElementById('total-skipped'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalOk: document.getElementById('modal-ok'),
    closeModal: document.querySelector('.close')
};

// Global değişkenler
let isConnected = false;
let isSending = false;
let shouldStopSending = false;
let templates = [];
let progressInterval = null;
let autoResumeCountdown = null;
let autoResumeTimer = null;
let selectedImage = null;
let selectedTemplates = [];
let currentTemplateMode = 'single';

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadTemplates();
    loadSentMessages();
    checkConnectionStatus();
});

// Uygulama başlatma
function initializeApp() {
    console.log('WhatsApp Toplu Mesaj Gönderici başlatılıyor...');
    loadQRCode();
    updateNumberCount();
    updateMessageLength();
    hideSkippedNumbers(); // Atlanan numaralar bölümünü başlangıçta gizle
    updateStats(); // İstatistikleri güncelle
    
    // Varsayılan şablon modunu ayarla
    currentTemplateMode = 'single';
    
    // Element kontrolü
    if (!elements.messageLength) {
        console.warn('messageLength elementi bulunamadı');
    }
}

// Event listener'ları ayarla
function setupEventListeners() {
    // QR kod yenileme
    elements.refreshQr.addEventListener('click', loadQRCode);
    
    // Numara listesi
    elements.phoneNumbers.addEventListener('input', updateNumberCount);
    elements.clearNumbers.addEventListener('click', clearNumberList);
    elements.loadExample.addEventListener('click', loadExampleNumbers);
    
    // Mesaj içeriği
    elements.messageContent.addEventListener('input', updateMessageLength);
    
    // Şablon işlemleri
    elements.templateSelect.addEventListener('change', loadSelectedTemplate);
    elements.saveTemplate.addEventListener('click', showTemplateSaveForm);
    elements.confirmSaveTemplate.addEventListener('click', saveTemplate);
    elements.cancelSaveTemplate.addEventListener('click', hideTemplateSaveForm);
    
    // Gönderim işlemleri
    elements.startSending.addEventListener('click', startBulkSending);
    elements.stopSending.addEventListener('click', stopBulkSending);
    elements.pauseSending.addEventListener('click', pauseBulkSending);
    elements.resumeSending.addEventListener('click', resumeBulkSending);
    elements.refreshSent.addEventListener('click', loadSentMessages);
    
    // Görsel işlemleri
    elements.imageUpload.addEventListener('change', handleImageUpload);
    elements.removeImage.addEventListener('click', removeSelectedImage);
    elements.loadSampleImage.addEventListener('click', loadSampleImage);
    
    // Şablon modu değişimi
    document.querySelectorAll('input[name="template-mode"]').forEach(radio => {
        radio.addEventListener('change', handleTemplateModeChange);
    });
    elements.selectAllTemplates.addEventListener('click', selectAllTemplates);
    
    // Modal
    elements.modalOk.addEventListener('click', closeModal);
    elements.closeModal.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', function(e) {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
}

// QR kod yükleme
async function loadQRCode() {
    try {
        elements.qrCode.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>QR kod yükleniyor...</p>';
        
        const response = await fetch('/api/qr');
        const data = await response.json();
        
        if (data.authenticated) {
            elements.qrCode.innerHTML = '<i class="fas fa-check-circle"></i><p>WhatsApp zaten bağlı!</p>';
            elements.connectionStatus.className = 'connection-status status-connected';
            elements.connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Bağlı</span>';
            isConnected = true;
            updateSendButton();
        } else if (data.qr) {
            elements.qrCode.innerHTML = `<img src="${data.qr}" alt="QR Kod"><p class="qr-instruction">QR kodu ana sayfadan taratın</p>`;
            elements.connectionStatus.className = 'connection-status status-disconnected';
            elements.connectionStatus.innerHTML = '<i class="fas fa-times-circle"></i><span>Bağlı değil</span>';
            isConnected = false;
            updateSendButton();
        } else {
            elements.qrCode.innerHTML = '<i class="fas fa-exclamation-triangle"></i><p>QR kod henüz hazır değil</p>';
            elements.connectionStatus.className = 'connection-status status-disconnected';
            elements.connectionStatus.innerHTML = '<i class="fas fa-times-circle"></i><span>Bağlı değil</span>';
            isConnected = false;
            updateSendButton();
        }
    } catch (error) {
        console.error('QR kod yükleme hatası:', error);
        elements.qrCode.innerHTML = '<i class="fas fa-times-circle"></i><p>QR kod yüklenemedi</p>';
    }
}

// Bağlantı durumu kontrolü
async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Sunucu tarafında ready (isConnected) bazen geç gelebilir; authenticated yeterli sayılmalı
        isConnected = (data.connected || data.authenticated);
        
        // Eğer kimlik doğrulaması yapılmışsa QR kodu temizle
        if (data.authenticated) {
            elements.qrCode.innerHTML = '<i class="fas fa-check-circle"></i><p>WhatsApp bağlandı!</p>';
        } else if (data.needsQR) {
            // QR kod gerekiyorsa yeniden yükle
            loadQRCode();
        }
        
        updateConnectionStatus();
        updateSendButton();
        
        // Periyodik kontrol
        setTimeout(checkConnectionStatus, 5000);
    } catch (error) {
        console.error('Bağlantı durumu kontrol hatası:', error);
    }
}

// Bağlantı durumunu güncelle
function updateConnectionStatus() {
    if (isConnected) {
        elements.connectionStatus.className = 'connection-status status-connected';
        elements.connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Bağlı</span>';
        elements.qrCode.innerHTML = '<i class="fas fa-check-circle"></i><p>WhatsApp bağlandı!</p>';
    } else {
        elements.connectionStatus.className = 'connection-status status-disconnected';
        elements.connectionStatus.innerHTML = '<i class="fas fa-times-circle"></i><span>Bağlı değil</span>';
    }
}

// Gönder butonunu güncelle
function updateSendButton() {
    const hasNumbers = getPhoneNumbers().length > 0;
    let canSend = false;
    
    if (currentTemplateMode === 'multiple') {
        // Çoklu şablon modunda: numara + seçili şablon yeterli
        canSend = hasNumbers && selectedTemplates.length > 0;
    } else {
        // Tek şablon modunda: numara + mesaj içeriği gerekli
        const hasMessage = elements.messageContent.value.trim().length > 0;
        canSend = hasNumbers && hasMessage;
    }
    
    elements.startSending.disabled = !isConnected || !canSend;
}

// LocalStorage anahtarları
const STORAGE_KEY = 'bulk_send_status';

function saveSendStatus(status) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
}

function loadSendStatus() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function clearSendStatus() {
    localStorage.removeItem(STORAGE_KEY);
}

// Numara sayısını güncelle
function updateNumberCount() {
    const numbers = getPhoneNumbers();
    elements.numberCount.textContent = numbers.length;
    updateSendButton();
    const sentStatus = loadSendStatus();
    updateVisualNumberList(sentStatus); // localStorage'dan oku
}

// Numara listesini görsel olarak güncelle
function updateVisualNumberList(sentStatus = {}) {
    const numbers = getPhoneNumbers();
    const container = elements.visualNumberList || document.getElementById('visual-number-list');
    if (!container) return;
    container.innerHTML = '';
    numbers.forEach((num, idx) => {
        const div = document.createElement('div');
        let statusClass = 'unsent';
        let statusText = '';
        
        if (sentStatus[num] === true) {
            statusClass = 'sent';
            statusText = ' ✓ Gönderildi';
        } else if (sentStatus[num] === 'skipped') {
            statusClass = 'skipped';
            statusText = ' ⏰ Atlanmış (30 gün)';
        } else if (sentStatus[num] === false) {
            statusClass = 'error';
            statusText = ' ✗ Hata';
        }
        
        div.className = `visual-number-item ${statusClass}`;
        div.textContent = num + statusText;
        container.appendChild(div);
    });
}

// Mesaj uzunluğunu güncelle
function updateMessageLength() {
    if (!elements.messageContent || !elements.messageLength) return;
    
    const length = elements.messageContent.value.length;
    elements.messageLength.textContent = length;
    
    // Renk kodlaması ekle
    const messageInfo = elements.messageLength.parentElement;
    if (!messageInfo) return;
    
    // Element referansını güncelle
    elements.messageLength = document.getElementById('message-length');
    
    if (selectedImage && length > 1024) {
        messageInfo.style.color = '#dc3545'; // Kırmızı
        messageInfo.innerHTML = `<span id="message-length">${length}</span> karakter <span style="color: #dc3545;">(Görsel ile max 1024)</span>`;
    } else if (!selectedImage && length > 4096) {
        messageInfo.style.color = '#ffc107'; // Sarı
        messageInfo.innerHTML = `<span id="message-length">${length}</span> karakter <span style="color: #ffc107;">(Uzun mesaj uyarısı)</span>`;
    } else {
        messageInfo.style.color = '#6c757d'; // Normal gri
        messageInfo.innerHTML = `<span id="message-length">${length}</span> karakter`;
    }
    
    // Element referansını tekrar güncelle
    elements.messageLength = document.getElementById('message-length');
    
    updateSendButton();
}

// Telefon numaralarını al
function getPhoneNumbers() {
    const text = elements.phoneNumbers.value.trim();
    if (!text) return [];
    
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

// Numara listesini temizle
function clearNumberList() {
    elements.phoneNumbers.value = '';
    clearSendStatus();
    updateNumberCount();
}

// Örnek numaralar yükle
function loadExampleNumbers() {
    const exampleNumbers = [
        '+905551234567',
        '+905551234568',
        '+905551234569',
        '+905551234570'
    ];
    
    elements.phoneNumbers.value = exampleNumbers.join('\n');
    updateNumberCount();
}

// Şablonları yükle
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        templates = await response.json();
        
        // Select'i güncelle
        elements.templateSelect.innerHTML = '<option value="">Şablon seçin...</option>';
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            elements.templateSelect.appendChild(option);
        });
        
        // Çoklu şablon modundaysa checkbox listesini de güncelle
        if (currentTemplateMode === 'multiple') {
            loadTemplateCheckboxes();
        }
    } catch (error) {
        console.error('Şablon yükleme hatası:', error);
    }
}

// Seçili şablonu yükle
function loadSelectedTemplate() {
    const templateId = elements.templateSelect.value;
    if (!templateId) return;
    
    const template = templates.find(t => t.id == templateId);
    if (template) {
        elements.messageContent.value = template.content;
        updateMessageLength();
    }
}

// Şablon kaydetme formunu göster
function showTemplateSaveForm() {
    const content = elements.messageContent.value.trim();
    if (!content) {
        showModal('Uyarı', 'Önce mesaj içeriği yazın!');
        return;
    }
    
    elements.templateSaveForm.style.display = 'flex';
    elements.templateName.focus();
}

// Şablon kaydetme formunu gizle
function hideTemplateSaveForm() {
    elements.templateSaveForm.style.display = 'none';
    elements.templateName.value = '';
}

// Şablon kaydet
async function saveTemplate() {
    const name = elements.templateName.value.trim();
    const content = elements.messageContent.value.trim();
    
    if (!name) {
        showModal('Uyarı', 'Şablon adı gerekli!');
        return;
    }
    
    if (!content) {
        showModal('Uyarı', 'Mesaj içeriği gerekli!');
        return;
    }
    
    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, content })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showModal('Başarılı', 'Şablon başarıyla kaydedildi!');
            hideTemplateSaveForm();
            loadTemplates();
        } else {
            showModal('Hata', data.error || 'Şablon kaydedilemedi!');
        }
    } catch (error) {
        console.error('Şablon kaydetme hatası:', error);
        showModal('Hata', 'Şablon kaydedilemedi!');
    }
}

// Toplu mesaj gönderimi başlat
async function startBulkSending() {
    let numbers = getPhoneNumbers();
    const message = elements.messageContent.value.trim();
    const delay = parseInt(elements.delayInput.value) || 5;
    const previewMode = elements.previewMode.checked;
    const sendOrder = document.getElementById('send-order')?.value || 'sequential';

    // Çoklu şablon modunda kontroller
    if (currentTemplateMode === 'multiple') {
        if (selectedTemplates.length === 0) {
            showModal('Uyarı', 'Çoklu şablon modunda en az bir şablon seçmelisiniz!');
            return;
        }
        // Çoklu şablon modunda mesaj içeriği şablonlardan gelecek
    } else {
        // Tek şablon modunda mesaj kontrolü
        if (!message) {
            showModal('Uyarı', 'Mesaj içeriği boş!');
            return;
        }
        
        // Görsel ile mesaj uzunluğu kontrolü
        if (selectedImage && message.length > 1024) {
            showModal('Uyarı', 'Görsel ile birlikte gönderilen mesajlar maksimum 1024 karakter olabilir. Şu anki mesajınız ' + message.length + ' karakter. Lütfen mesajınızı kısaltın.');
            return;
        }
        
        // Sadece metin mesajı uzunluk kontrolü
        if (!selectedImage && message.length > 4096) {
            showModal('Uyarı', 'Çok uzun mesajlar WhatsApp tarafından reddedilebilir. Mesajınızı ' + message.length + ' karakter. 4096 karakterden kısa tutmanız önerilir.');
        }
    }

    // Sıralama seçimine göre numaraları sırala
    if (sendOrder === 'random') {
        numbers = shuffleArray(numbers);
    }

    // Gönderim durumu localStorage'a kaydedilsin
    let sentStatus = loadSendStatus();
    numbers.forEach(num => {
        if (!(num in sentStatus)) sentStatus[num] = false;
    });
    saveSendStatus(sentStatus);
    updateVisualNumberList(sentStatus);
    
    if (!isConnected) {
        showModal('Hata', 'WhatsApp bağlı değil!');
        return;
    }
    if (numbers.length === 0) {
        showModal('Uyarı', 'Numara listesi boş!');
        return;
    }

    if (previewMode) {
        showModal('Önizleme', `Bu modda ${numbers.length} numaraya mesaj gönderilecek:\n\n${numbers.join('\n')}\n\nMesaj: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        return;
    }
    elements.sendingStatus.style.display = 'block';
    isSending = true;
    shouldStopSending = false;
    updateProgress(0, numbers.length);
    elements.successCount.textContent = '0';
    elements.errorCount.textContent = '0';
    
    // Progress polling başlat
    startProgressPolling();
    
    try {
        const requestData = { 
            numbers, 
            message, 
            delay,
            image: selectedImage,
            templateMode: currentTemplateMode,
            selectedTemplates: currentTemplateMode === 'multiple' ? selectedTemplates : null
        };
        
        const response = await fetch('/api/send-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        if (response.status === 413) {
            showModal('Hata', 'Görsel çok büyük! Lütfen daha küçük bir görsel seçin (maksimum 5MB).');
            return;
        }
        
        const data = await response.json();
        if (response.ok) {
            processSendingResults(data.results, numbers, data.skippedNumbers || []);
        } else {
            showModal('Hata', data.error || 'Mesaj gönderimi başarısız!');
        }
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        if (error.message.includes('Failed to fetch')) {
            showModal('Hata', 'Sunucu bağlantısı kesildi. Lütfen sayfayı yenileyin.');
        } else {
            showModal('Hata', 'Mesaj gönderimi başarısız: ' + error.message);
        }
    } finally {
        isSending = false;
        stopProgressPolling();
        // Bağlantı varsa mesajları yükle
        try {
            loadSentMessages();
            updateStats();
        } catch (e) {
            console.warn('Mesaj listesi yüklenemedi:', e);
        }
    }
}

// Gönderim sonuçlarını işle
function processSendingResults(results, numbers, skippedNumbers = []) {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let sentStatus = loadSendStatus();
    
    results.forEach((result, index) => {
        const phoneNumber = numbers[index];
        if (result.success) {
            successCount++;
            sentStatus[phoneNumber] = true;
        } else if (result.skipped) {
            skippedCount++;
            sentStatus[phoneNumber] = 'skipped';
        } else {
            errorCount++;
            sentStatus[phoneNumber] = false;
        }
        saveSendStatus(sentStatus);
        updateVisualNumberList(sentStatus);
    });
    
    // Atlanan numaraları göster
    if (skippedNumbers.length > 0) {
        showSkippedNumbers(skippedNumbers);
    }
    
    // Progress polling zaten güncellediği için burada tekrar güncellemeye gerek yok
    if (successCount > 0) {
        showModal('Başarılı', `${successCount} mesaj başarıyla gönderildi!${errorCount > 0 ? `\n${errorCount} mesaj gönderilemedi.` : ''}${skippedCount > 0 ? `\n${skippedCount} numara atlandı (son 30 gün içinde mesaj gönderilmiş).` : ''}`);
    } else {
        showModal('Hata', 'Hiçbir mesaj gönderilemedi!');
    }
    saveSendStatus(sentStatus);
    updateVisualNumberList(sentStatus);
}

// Atlanan numaraları göster
function showSkippedNumbers(skippedNumbers) {
    if (skippedNumbers.length === 0) {
        elements.skippedNumbers.style.display = 'none';
        return;
    }
    
    elements.skippedNumbers.style.display = 'block';
    elements.totalSkipped.textContent = skippedNumbers.length;
    
    const skippedList = skippedNumbers.map(skipped => {
        const date = new Date(skipped.lastSentDate);
        const formattedDate = date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="skipped-number-item">
                <div class="number">${skipped.number}</div>
                <div class="date">Son gönderim: ${formattedDate}</div>
            </div>
        `;
    }).join('');
    
    elements.skippedNumbersList.innerHTML = skippedList;
}

// Atlanan numaraları gizle
function hideSkippedNumbers() {
    elements.skippedNumbers.style.display = 'none';
    elements.skippedNumbersList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>Atlanan numara yok</p>
        </div>
    `;
    elements.totalSkipped.textContent = '0';
}

// İstatistikleri güncelle
async function updateStats() {
    try {
        const response = await fetch('/api/sent-messages');
        const messages = await response.json();
        
        const totalSuccess = messages.filter(msg => msg.phone_number).length;
        const totalSkipped = parseInt(elements.totalSkipped.textContent) || 0;
        const totalError = parseInt(elements.totalError?.textContent) || 0;
        
        // Son aktivite tarihi
        let lastActivity = '-';
        if (messages.length > 0) {
            const lastMessage = messages[0];
            const date = new Date(lastMessage.sent_at);
            lastActivity = date.toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // İstatistikleri güncelle
        const totalSuccessEl = document.getElementById('total-success');
        const totalSkippedStatsEl = document.getElementById('total-skipped-stats');
        const totalErrorEl = document.getElementById('total-error');
        const lastActivityEl = document.getElementById('last-activity');
        
        if (totalSuccessEl) totalSuccessEl.textContent = totalSuccess;
        if (totalSkippedStatsEl) totalSkippedStatsEl.textContent = totalSkipped;
        if (totalErrorEl) totalErrorEl.textContent = totalError;
        if (lastActivityEl) lastActivityEl.textContent = lastActivity;
        
    } catch (error) {
        console.error('İstatistik güncelleme hatası:', error);
    }
}

// Gönderimi durdur
async function stopBulkSending() {
    try {
        const response = await fetch('/api/control/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'manual-stop' })
        });
        
        if (response.ok) {
            shouldStopSending = true;
            isSending = false;
            stopProgressPolling();
            showModal('Bilgi', 'Gönderim durduruldu.');
        }
    } catch (error) {
        console.error('Durdurma hatası:', error);
        showModal('Hata', 'Gönderim durdurulamadı.');
    }
}

// Gönderimi duraklatı
async function pauseBulkSending() {
    try {
        const response = await fetch('/api/control/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'manual-pause' })
        });
        
        if (response.ok) {
            elements.pauseSending.style.display = 'none';
            elements.resumeSending.style.display = 'inline-block';
            hideAutoResumeCountdown(); // Manuel duraklatmada geri sayımı gizle
            showModal('Bilgi', 'Gönderim duraklatıldı.');
        }
    } catch (error) {
        console.error('Duraklatma hatası:', error);
        showModal('Hata', 'Gönderim duraklatılamadı.');
    }
}

// Gönderimi devam ettir
async function resumeBulkSending() {
    try {
        const response = await fetch('/api/control/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            elements.pauseSending.style.display = 'inline-block';
            elements.resumeSending.style.display = 'none';
            hideAutoResumeCountdown();
            showModal('Bilgi', 'Gönderim devam ediyor.');
        }
    } catch (error) {
        console.error('Devam ettirme hatası:', error);
        showModal('Hata', 'Gönderim devam ettirilemedi.');
    }
}

// Otomatik devam geri sayımını başlat
function startAutoResumeCountdown() {
    let seconds = 30; // 30 saniye
    
    elements.autoResumeInfo.style.display = 'block';
    elements.countdownTimer.textContent = seconds;
    
    autoResumeCountdown = setInterval(() => {
        seconds--;
        elements.countdownTimer.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(autoResumeCountdown);
            elements.autoResumeInfo.style.display = 'none';
            // Otomatik devam ettirme - sunucu zaten yapacak ama UI'yi güncelle
            elements.pauseSending.style.display = 'inline-block';
            elements.resumeSending.style.display = 'none';
        }
    }, 1000);
}

// Otomatik devam geri sayımını gizle
function hideAutoResumeCountdown() {
    if (autoResumeCountdown) {
        clearInterval(autoResumeCountdown);
        autoResumeCountdown = null;
    }
    elements.autoResumeInfo.style.display = 'none';
}

// Görsel yükleme işlemi
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Dosya boyutu kontrolü (2MB - daha güvenli)
    if (file.size > 2 * 1024 * 1024) {
        showModal('Uyarı', 'Görsel boyutu 2MB\'dan küçük olmalıdır. Seçilen dosya: ' + (file.size / 1024 / 1024).toFixed(2) + 'MB');
        event.target.value = '';
        return;
    }
    
    // Dosya türü kontrolü
    if (!file.type.startsWith('image/')) {
        showModal('Uyarı', 'Sadece görsel dosyaları yükleyebilirsiniz.');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedImage = {
            data: e.target.result,
            name: file.name,
            type: file.type
        };
        
        // Önizleme göster
        elements.previewImg.src = e.target.result;
        elements.imagePreview.style.display = 'block';
        
        // Mesaj uzunluğunu yeniden kontrol et
        updateMessageLength();
    };
    
    reader.readAsDataURL(file);
}

// Seçili görseli kaldır
function removeSelectedImage() {
    selectedImage = null;
    elements.imageUpload.value = '';
    elements.imagePreview.style.display = 'none';
    elements.previewImg.src = '';
    
    // Mesaj uzunluğunu yeniden kontrol et
    updateMessageLength();
}

// Örnek görsel yükle
function loadSampleImage() {
    // Lüks araç görseli için base64 data (küçük bir örnek)
    const sampleImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    
    selectedImage = {
        data: sampleImageData,
        name: 'luxury-van.jpg',
        type: 'image/jpeg'
    };
    
    // Önizleme göster
    elements.previewImg.src = sampleImageData;
    elements.imagePreview.style.display = 'block';
    
    // Mesaj uzunluğunu yeniden kontrol et
    updateMessageLength();
    
    showModal('Bilgi', 'Örnek lüks araç görseli yüklendi. Kendi görselinizi yüklemek için "Dosya Seç" butonunu kullanabilirsiniz.');
}

// Şablon modu değişimi
function handleTemplateModeChange(event) {
    currentTemplateMode = event.target.value;
    
    if (!elements.singleTemplateMode || !elements.multipleTemplateMode) {
        console.warn('Template mode elements not found');
        return;
    }
    
    if (currentTemplateMode === 'single') {
        elements.singleTemplateMode.style.display = 'block';
        elements.multipleTemplateMode.style.display = 'none';
        // Mesaj alanını aktif et
        elements.messageContent.disabled = false;
        elements.messageContent.placeholder = 'Mesajınızı buraya yazın...';
    } else {
        elements.singleTemplateMode.style.display = 'none';
        elements.multipleTemplateMode.style.display = 'block';
        // Mesaj alanını devre dışı bırak
        elements.messageContent.disabled = true;
        elements.messageContent.placeholder = 'Çoklu şablon modunda mesajlar seçili şablonlardan gelir...';
        elements.messageContent.value = '';
        loadTemplateCheckboxes();
    }
    
    // Gönder butonunu güncelle
    updateSendButton();
}

// Şablon checkbox listesini yükle
function loadTemplateCheckboxes() {
    if (!elements.templateCheckboxList) {
        console.warn('Template checkbox list element not found');
        return;
    }
    
    if (!templates || templates.length === 0) {
        elements.templateCheckboxList.innerHTML = '<p style="text-align: center; color: #666;">Henüz şablon yok</p>';
        return;
    }
    
    elements.templateCheckboxList.innerHTML = templates.map(template => `
        <div class="template-checkbox-item">
            <input type="checkbox" id="template-${template.id}" value="${template.id}" onchange="window.updateSelectedTemplates()">
            <label for="template-${template.id}">
                ${template.name}
                <div class="template-preview">${template.content.substring(0, 50)}${template.content.length > 50 ? '...' : ''}</div>
            </label>
        </div>
    `).join('');
    
    updateSelectedTemplatesCount();
}

// Seçili şablonları güncelle
function updateSelectedTemplates() {
    const checkboxes = document.querySelectorAll('#template-checkbox-list input[type="checkbox"]:checked');
    selectedTemplates = Array.from(checkboxes).map(cb => parseInt(cb.value));
    updateSelectedTemplatesCount();
}

// Global scope'a ekle
window.updateSelectedTemplates = updateSelectedTemplates;

// Seçili şablon sayısını güncelle
function updateSelectedTemplatesCount() {
    const count = selectedTemplates.length;
    if (elements.selectedTemplatesCount) {
        elements.selectedTemplatesCount.textContent = count;
        
        if (count > 0) {
            elements.selectedTemplatesCount.parentElement.style.display = 'block';
        } else {
            elements.selectedTemplatesCount.parentElement.style.display = 'none';
        }
    }
    
    // Gönder butonunu güncelle
    updateSendButton();
}

// Tüm şablonları seç/seçimi kaldır
function selectAllTemplates() {
    const checkboxes = document.querySelectorAll('#template-checkbox-list input[type="checkbox"]');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allSelected;
    });
    
    updateSelectedTemplates();
    
    elements.selectAllTemplates.innerHTML = allSelected 
        ? '<i class="fas fa-check-double"></i> Tümünü Seç'
        : '<i class="fas fa-times"></i> Seçimi Kaldır';
}

// İlerleme çubuğunu güncelle
function updateProgress(current, total) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `${current} / ${total}`;
    elements.progressPercentage.textContent = `${Math.round(percentage)}%`;
}

// Progress polling başlat
function startProgressPolling() {
    if (progressInterval) {
        clearInterval(progressInterval);
    }
    
    progressInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/control/status');
            const controlStatus = await response.json();
            
            // Duraklatma durumunu kontrol et ve butonları güncelle
            if (controlStatus.isPaused) {
                elements.pauseSending.style.display = 'none';
                elements.resumeSending.style.display = 'inline-block';
                
                // Eğer otomatik duraklatma ise geri sayımı başlat
                if (controlStatus.reason === 'auto-pause:inbound-message' && !autoResumeCountdown) {
                    startAutoResumeCountdown();
                }
            } else {
                elements.pauseSending.style.display = 'inline-block';
                elements.resumeSending.style.display = 'none';
                hideAutoResumeCountdown();
            }
            
            // Progress bilgilerini al
            const progressResponse = await fetch('/api/progress');
            const progress = await progressResponse.json();
            
            if (progress.isActive) {
                updateProgress(progress.current, progress.total);
                elements.successCount.textContent = progress.successCount;
                elements.errorCount.textContent = progress.errorCount;
                elements.skippedCount.textContent = progress.skippedCount || 0;
            } else {
                // Progress tamamlandı, polling'i durdur
                stopProgressPolling();
                elements.pauseSending.style.display = 'none';
                elements.resumeSending.style.display = 'none';
            }
        } catch (error) {
            console.error('Progress polling hatası:', error);
        }
    }, 1000); // Her saniye kontrol et
}

// Progress polling durdur
function stopProgressPolling() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    hideAutoResumeCountdown();
}

// Gönderilen mesajları yükle
async function loadSentMessages() {
    try {
        const response = await fetch('/api/sent-messages');
        const messages = await response.json();
        
        if (messages.length === 0) {
            elements.sentMessagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Henüz mesaj gönderilmedi</p>
                </div>
            `;
            return;
        }
        
        elements.sentMessagesList.innerHTML = messages.map(message => `
            <div class="sent-message-item">
                <div class="phone">${message.phone_number}</div>
                <div class="message">${message.message.substring(0, 100)}${message.message.length > 100 ? '...' : ''}</div>
                <div class="time">${new Date(message.sent_at).toLocaleString('tr-TR')}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Gönderilen mesajlar yükleme hatası:', error);
    }
}

// Modal göster
function showModal(title, message) {
    elements.modalTitle.textContent = title;
    elements.modalMessage.textContent = message;
    elements.modal.style.display = 'block';
}

// Modal kapat
function closeModal() {
    elements.modal.style.display = 'none';
}

// Klavye kısayolları
document.addEventListener('keydown', function(e) {
    // Ctrl+Enter ile gönderimi başlat
    if (e.ctrlKey && e.key === 'Enter') {
        if (!elements.startSending.disabled) {
            elements.startSending.click();
        }
    }
    
    // Escape ile modal kapat
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Sayfa kapatılırken uyarı
window.addEventListener('beforeunload', function(e) {
    if (isSending) {
        e.preventDefault();
        e.returnValue = 'Mesaj gönderimi devam ediyor. Sayfayı kapatmak istediğinizden emin misiniz?';
        return e.returnValue;
    }
});

// Periyodik QR kod yenileme (bağlı değilse)
setInterval(() => {
    if (!isConnected) {
        loadQRCode();
    }
}, 30000); // 30 saniyede bir 

// Rastgele karıştırma fonksiyonu
function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
} 