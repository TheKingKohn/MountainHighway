/**
 * Keep-alive service for Mountain Highway
 * Pings both API and web services every 10 minutes to prevent cold starts
 */

const https = require('https');
const http = require('http');

// Configuration
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
const SERVICES = [
    {
        name: 'Mountain Highway API',
        url: 'https://mountain-highway-api.onrender.com/health',
        timeout: 30000
    },
    {
        name: 'Mountain Highway Web',
        url: 'https://mountain-highway.onrender.com',
        timeout: 30000
    }
];

/**
 * Make HTTP request to ping a service
 */
function pingService(service) {
    return new Promise((resolve, reject) => {
        const url = new URL(service.url);
        const module = url.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'GET',
            timeout: service.timeout,
            headers: {
                'User-Agent': 'Mountain-Highway-KeepAlive/1.0'
            }
        };

        const req = module.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    service: service.name,
                    status: res.statusCode,
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    timestamp: new Date().toISOString()
                });
            });
        });

        req.on('error', (error) => {
            reject({
                service: service.name,
                error: error.message,
                success: false,
                timestamp: new Date().toISOString()
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                service: service.name,
                error: 'Request timeout',
                success: false,
                timestamp: new Date().toISOString()
            });
        });

        req.end();
    });
}

/**
 * Ping all services
 */
async function pingAllServices() {
    console.log(`\n🏔️  Mountain Highway Keep-Alive - ${new Date().toLocaleString()}`);
    console.log('=' .repeat(60));
    
    for (const service of SERVICES) {
        try {
            const result = await pingService(service);
            if (result.success) {
                console.log(`✅ ${result.service}: OK (${result.status})`);
            } else {
                console.log(`❌ ${result.service}: Failed (${result.status})`);
            }
        } catch (error) {
            console.log(`💥 ${error.service}: Error - ${error.error}`);
        }
    }
    
    console.log(`⏰ Next ping in ${PING_INTERVAL / 1000 / 60} minutes...`);
}

/**
 * Start the keep-alive service
 */
function startKeepAlive() {
    console.log('🚀 Starting Mountain Highway Keep-Alive Service');
    console.log(`📡 Pinging every ${PING_INTERVAL / 1000 / 60} minutes`);
    console.log('Services:');
    SERVICES.forEach(service => {
        console.log(`   - ${service.name}: ${service.url}`);
    });
    
    // Initial ping
    pingAllServices();
    
    // Set up interval
    setInterval(pingAllServices, PING_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Mountain Highway Keep-Alive Service');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down Mountain Highway Keep-Alive Service');
    process.exit(0);
});

// Start the service
if (require.main === module) {
    startKeepAlive();
}

module.exports = { pingAllServices, startKeepAlive };
