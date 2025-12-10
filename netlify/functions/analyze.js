// Netlify Serverless Function: /api/analyze
// Using standard Netlify Functions format

const { GoogleGenAI } = require('@google/genai');

// System prompt
const SYSTEM_PROMPT = `
You are an expert academic digitizer acting as a High-Precision OCR Engine.
Your task is to analyze handwritten exam papers and convert them into a STRICT JSON format.
The output MUST be a single JSON object containing a "sections" array.
Return ONLY valid JSON. No markdown formatting.
`;

// Validation
const MAX_IMAGES = 10;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const validateImages = (images) => {
    if (!images || !Array.isArray(images) || images.length === 0) {
        return { valid: false, error: 'At least one image is required' };
    }
    if (images.length > MAX_IMAGES) {
        return { valid: false, error: `Maximum ${MAX_IMAGES} images allowed` };
    }
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img?.data || !img?.mimeType) {
            return { valid: false, error: `Image ${i + 1}: Missing data or mimeType` };
        }
        if (!ALLOWED_MIME_TYPES.includes(img.mimeType)) {
            return { valid: false, error: `Image ${i + 1}: Unsupported format` };
        }
    }
    return { valid: true };
};

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { images, prompt } = body;

        // Validate
        const validation = validateImages(images);
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: validation.error })
            };
        }

        // Check API key
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error('VITE_GEMINI_API_KEY not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Initialize Gemini
        const ai = new GoogleGenAI({ apiKey });

        // Build image parts
        const imageParts = images.map(img => ({
            inlineData: { data: img.data, mimeType: img.mimeType }
        }));

        const userPrompt = prompt ||
            "Analyze these handwritten exam sheets. Extract all questions and sections. Output strictly as JSON.";

        console.log('Calling Gemini with', images.length, 'images...');

        // Call Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [...imageParts, { text: userPrompt }] },
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.0,
                responseMimeType: 'application/json'
            }
        });

        console.log('Gemini response received');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, result: response.text || '' })
        };

    } catch (error) {
        console.error('Error:', error.message, error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'AI analysis failed. Please try again.' })
        };
    }
};
