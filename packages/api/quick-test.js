// Quick test of minimal server
const http = require('http');

console.log('🔍 Testing minimal server...');

http.get('http://localhost:4000/health', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log(`✅ Health check: Status ${res.statusCode}`);
        console.log(`📋 Response: ${data}`);
        process.exit(0);
    });
}).on('error', (error) => {
    console.log(`❌ Request failed: ${error.message}`);
    process.exit(1);
});
