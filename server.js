import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from './constants.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Large limit for image data

// Validate API key exists
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('❌ ERROR: VITE_GEMINI_API_KEY is not set in .env.local');
    process.exit(1);
}

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * POST /api/analyze
 * Secure endpoint to analyze exam sheets via Gemini API
 * Request body: { images: [{ data: string, mimeType: string }], prompt?: string }
 */
app.post('/api/analyze', async (req, res) => {
    try {
        const { images, prompt } = req.body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                error: 'Images array is required and must not be empty'
            });
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

        // Call Gemini API with correct format per official docs
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    ...imageParts,
                    { text: userPrompt }
                ]
            },
            config: {
                systemInstruction: SYSTEM_PROMPT, // String format - correct per SDK docs
                temperature: 0.0,
                responseMimeType: 'application/json'
            }
        });

        console.log('✅ Gemini API call successful');

        res.json({
            success: true,
            result: response.text || ''
        });

    } catch (error) {
        console.error('❌ Gemini API error:', error.message);
        res.status(500).json({
            error: 'Failed to analyze exam sheet',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`🔒 Gemini API key is secured server-side`);
});
