// Keep-alive sistemi (sleep önleme)
const keepAlive = () => {
  // Kendi URL'ine ping at (sleep önleme)
  const url = process.env.RENDER_EXTERNAL_URL || 
              process.env.RAILWAY_STATIC_URL || 
              'http://localhost:3000';
  
  if (url && url !== 'http://localhost:3000') {
    setInterval(async () => {
      try {
        const fetch = require('node-fetch');
        await fetch(`${url}/api/status`);
        console.log('🔄 Keep-alive ping sent');
      } catch (error) {
        console.log('⚠️ Keep-alive ping failed:', error.message);
      }
    }, 14 * 60 * 1000); // 14 dakikada bir
    
    console.log('✅ Keep-alive sistemi aktif');
  }
};

module.exports = keepAlive;