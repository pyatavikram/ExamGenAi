// Netlify Serverless Function: /api/analyze
import { GoogleGenAI } from '@google/genai';

// System prompt for OCR
const SYSTEM_PROMPT = `
You are an expert academic digitizer acting as a High-Precision OCR Engine.
Your task is to analyze handwritten exam papers and convert them into a STRICT JSON format.

The output MUST be a single JSON object with a "sections" array.
Return ONLY valid JSON. No markdown formatting.
`;

// Validation
const MAX_IMAGES = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function validateImages(images) {
    if (!images || !Array.isArray(images) || images.length === 0) {
        return { valid: false, error: 'At least one image is required' };
    }
    if (images.length > MAX_IMAGES) {
        return { valid: false, error: `Maximum ${MAX_IMAGES} images allowed` };
    }
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img || !img.data || !img.mimeType) {
            return { valid: false, error: `Image ${i + 1}: Missing data or mimeType` };
        }
        if (!ALLOWED_MIME_TYPES.includes(img.mimeType)) {
            return { valid: false, error: `Image ${i + 1}: Unsupported format` };
        }
    }
    return { valid: true };
}

// Handler
export const handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { images, prompt } = body;

        const validation = validateImages(images);
        if (!validation.valid) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: validation.error }) };
        }

        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error('ERROR: VITE_GEMINI_API_KEY not set');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
        }

        const ai = new GoogleGenAI({ apiKey });
        const imageParts = images.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } }));

        console.log(`Processing ${images.length} image(s)...`);

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [...imageParts, { text: prompt || 'Analyze these exam sheets. Output as JSON.' }] },
            config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.0, responseMimeType: 'application/json' }
        });

        console.log('Success');
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, result: response.text || '' }) };

    } catch (error) {
        console.error('Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI analysis failed. Please try again.' }) };
    }
};
