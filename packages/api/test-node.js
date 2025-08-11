// Test script using Node.js instead of PowerShell
const http = require('http');

async function testEndpoint(url, name) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Testing ${name}...`);
        
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`✅ ${name}: Status ${res.statusCode}`);
                console.log(`📋 Response: ${data}`);
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log(`❌ ${name} failed: ${error.message}`);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.log(`⏰ ${name} timeout`);
            req.destroy();
            resolve(false);
        });
    });
}

async function runTests() {
    console.log('🚀 Starting connectivity tests...');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testEndpoint('http://localhost:4000/health', 'Health Check');
    await testEndpoint('http://localhost:4000/db-test', 'Database Test');
    await testEndpoint('http://localhost:4000/', 'API Info');
    
    console.log('\n🏁 Tests complete!');
    process.exit(0);
}

runTests();
