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
    elements.refreshSent.addEventListener('click', loadSentMessages);
    
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
        
        isConnected = data.connected && data.authenticated;
        
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
    const hasMessage = elements.messageContent.value.trim().length > 0;
    
    elements.startSending.disabled = !isConnected || !hasNumbers || !hasMessage;
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
    const length = elements.messageContent.value.length;
    elements.messageLength.textContent = length;
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
    if (!message) {
        showModal('Uyarı', 'Mesaj içeriği boş!');
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
        const response = await fetch('/api/send-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numbers, message, delay })
        });
        const data = await response.json();
        if (response.ok) {
            processSendingResults(data.results, numbers, data.skippedNumbers || []);
        } else {
            showModal('Hata', data.error || 'Mesaj gönderimi başarısız!');
        }
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        showModal('Hata', 'Mesaj gönderimi başarısız!');
    } finally {
        isSending = false;
        stopProgressPolling();
        loadSentMessages();
        updateStats(); // İstatistikleri güncelle
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
        document.getElementById('total-success').textContent = totalSuccess;
        document.getElementById('total-skipped-stats').textContent = totalSkipped;
        document.getElementById('total-error').textContent = totalError;
        document.getElementById('last-activity').textContent = lastActivity;
        
    } catch (error) {
        console.error('İstatistik güncelleme hatası:', error);
    }
}

// Gönderimi durdur
function stopBulkSending() {
    shouldStopSending = true;
    isSending = false;
    stopProgressPolling();
    showModal('Bilgi', 'Gönderim durduruldu.');
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
            const response = await fetch('/api/progress');
            const progress = await response.json();
            
            if (progress.isActive) {
                updateProgress(progress.current, progress.total);
                elements.successCount.textContent = progress.successCount;
                elements.errorCount.textContent = progress.errorCount;
                elements.skippedCount.textContent = progress.skippedCount || 0;
            } else {
                // Progress tamamlandı, polling'i durdur
                stopProgressPolling();
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