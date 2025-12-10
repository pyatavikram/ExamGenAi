import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from './server-constants.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

// Validate required environment variables
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ FATAL: VITE_GEMINI_API_KEY is not set in .env.local');
    process.exit(1);
}

// CORS Configuration - Read allowed origins from environment
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// =============================================================================
// MIDDLEWARE STACK
// =============================================================================

// 1. Security Headers (Helmet)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isDev ? false : undefined, // Disable CSP in dev for HMR
}));

// 2. Rate Limiting - Prevent API abuse
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? 100 : 10, // 10 requests per minute in production
    message: {
        error: 'Too many requests. Please wait before trying again.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 3. CORS - Cross-Origin Resource Sharing
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.) in dev
        if (!origin && isDev) return callback(null, true);

        if (CORS_ORIGINS.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 4. Body Parser with size limits
app.use(express.json({
    limit: '50mb', // Total request size limit
    strict: true
}));

// =============================================================================
// REQUEST VALIDATION HELPERS
// =============================================================================

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Validate image data structure and content
 */
const validateImages = (images) => {
    if (!images || !Array.isArray(images)) {
        return { valid: false, error: 'Images must be an array' };
    }

    if (images.length === 0) {
        return { valid: false, error: 'At least one image is required' };
    }

    if (images.length > MAX_IMAGES) {
        return { valid: false, error: `Maximum ${MAX_IMAGES} images allowed` };
    }

    for (let i = 0; i < images.length; i++) {
        const img = images[i];

        // Check structure
        if (!img || typeof img !== 'object') {
            return { valid: false, error: `Image ${i + 1}: Invalid format` };
        }

        if (!img.data || typeof img.data !== 'string') {
            return { valid: false, error: `Image ${i + 1}: Missing or invalid data` };
        }

        if (!img.mimeType || typeof img.mimeType !== 'string') {
            return { valid: false, error: `Image ${i + 1}: Missing or invalid mimeType` };
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(img.mimeType)) {
            return { valid: false, error: `Image ${i + 1}: Unsupported format. Use JPEG, PNG, GIF, or WebP` };
        }

        // Check base64 size (approximate)
        const sizeBytes = (img.data.length * 3) / 4;
        if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
            return { valid: false, error: `Image ${i + 1}: Exceeds ${MAX_IMAGE_SIZE_MB}MB limit` };
        }

        // Basic base64 validation
        if (!/^[A-Za-z0-9+/=]+$/.test(img.data)) {
            return { valid: false, error: `Image ${i + 1}: Invalid base64 encoding` };
        }
    }

    return { valid: true };
};

// =============================================================================
// GEMINI API CLIENT
// =============================================================================

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Call Gemini API with timeout and error handling
 */
const callGeminiAPI = async (imageParts, userPrompt, timeoutMs = 120000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log('📤 Calling Gemini API with', imageParts.length, 'images...');

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', // Using stable model
            contents: {
                parts: [
                    ...imageParts,
                    { text: userPrompt }
                ]
            },
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.0,
                responseMimeType: 'application/json'
            }
        });

        clearTimeout(timeoutId);
        console.log('✅ Gemini API response received');
        return { success: true, result: response.text || '' };
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            return { success: false, error: 'Request timeout. Please try with fewer or smaller images.' };
        }

        // Log full error for debugging
        console.error('❌ Gemini API Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        return { success: false, error: 'AI analysis failed. Please try again.' };
    }
};

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * POST /api/analyze
 * Secure endpoint to analyze exam sheets via Gemini API
 */
app.post('/api/analyze', async (req, res) => {
    try {
        const { images, prompt } = req.body;

        // Validate request
        const validation = validateImages(images);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Build content parts from images
        const imageParts = images.map(img => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        }));

        const userPrompt = prompt ||
            "Analyze these handwritten exam sheets. Extract all questions, sections, and visual elements. Output the result strictly as a raw JSON object following the defined schema. Do not use Markdown formatting.";

        // Call Gemini API with timeout
        const result = await callGeminiAPI(imageParts, userPrompt);

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Success - log minimal info
        if (isDev) {
            console.log('✅ Analysis completed successfully');
        }

        res.json({
            success: true,
            result: result.result
        });

    } catch (error) {
        // Never expose internal error details in production
        console.error('Request Error:', error.message);
        res.status(500).json({
            error: 'An unexpected error occurred. Please try again.'
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
    });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.message);

    // CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    // JSON parsing errors
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    // Request too large
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request too large. Maximum 50MB allowed.' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// SERVER STARTUP & GRACEFUL SHUTDOWN
// =============================================================================

const server = app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`🔒 Security: Rate limiting, CORS, Helmet enabled`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📋 Allowed origins: ${CORS_ORIGINS.join(', ')}`);
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
