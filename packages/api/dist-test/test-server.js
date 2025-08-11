"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 4002; // Different port
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (req, res) => {
    console.log('📋 Health check requested');
    res.json({ ok: true, test: 'minimal', timestamp: new Date().toISOString() });
});
// Database test endpoint
app.get('/db-test', async (req, res) => {
    try {
        console.log('📋 Database test requested');
        const userCount = await prisma.user.count();
        const listingCount = await prisma.listing.count();
        res.json({
            database: 'connected',
            userCount,
            listingCount,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Database error:', error);
        res.status(500).json({
            database: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Basic API info
app.get('/', (req, res) => {
    console.log('📋 API info requested');
    res.json({
        name: 'Mountain Highway API - Test Version',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});
// Enhanced error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Test API server running on http://localhost:${PORT}`);
    console.log(`📋 Health check available at http://localhost:${PORT}/health`);
});
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('📋 SIGINT received - shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('📋 SIGTERM received - shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});
