// Netlify Serverless Function: /api/analyze
// Secure endpoint to analyze exam sheets via Gemini API

import { GoogleGenAI } from '@google/genai';

// System prompt for the OCR engine
const SYSTEM_PROMPT = `
You are an expert academic digitizer acting as a High-Precision OCR Engine.
Your task is to analyze handwritten exam papers and convert them into a STRICT JSON format.

### 1. ROOT STRUCTURE (CRITICAL)
The output MUST be a single JSON object containing a "sections" array. 
❌ DO NOT return a raw array of questions.
✅ Correct Structure: { "sections": [ { "heading": "...", "questions": [...] } ] }

### 2. QUESTION OBJECT SCHEMA
Every Question Object inside the "questions" array MUST follow this structure exactly:
{
  "question_number": "string",
  "content_parts": [ 
    { 
      "type": "text" | "image" | "svg" | "table", 
      "value": "string",
      "reference": { "type": "image" | "svg", "value": "string" },
      "table_data": { "headers": ["string"], "rows": [ ["string"] ] }
    } 
  ],
  "answer_type": "mcq" | "grid" | "vertical_math" | "none",
  "answer_lines": number,
  "options": [ { "type": "text" | "image", "value": "string" } ], 
  "grid_config": { "rows": number, "cols": number }, 
  "match_pair": { "left": { "type": "text"|"image", "value": "..." }, "right": { "type": "text"|"image", "value": "..." } },
  "vertical_math_config": { 
    "subtype": "stack" | "division",
    "operator": "string", 
    "values": ["string"], 
    "dividend": "string", 
    "divisor": "string" 
  }
}

Return ONLY valid JSON. No markdown formatting.
`;

// Validation constants
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Validate images
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
        if (!img || typeof img !== 'object') {
            return { valid: false, error: `Image ${i + 1}: Invalid format` };
        }
        if (!img.data || typeof img.data !== 'string') {
            return { valid: false, error: `Image ${i + 1}: Missing or invalid data` };
        }
        if (!img.mimeType || typeof img.mimeType !== 'string') {
            return { valid: false, error: `Image ${i + 1}: Missing or invalid mimeType` };
        }
        if (!ALLOWED_MIME_TYPES.includes(img.mimeType)) {
            return { valid: false, error: `Image ${i + 1}: Unsupported format` };
        }
        const sizeBytes = (img.data.length * 3) / 4;
        if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
            return { valid: false, error: `Image ${i + 1}: Exceeds ${MAX_IMAGE_SIZE_MB}MB limit` };
        }
    }
    return { valid: true };
};

// Main handler
export default async (request, context) => {
    // Only allow POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json();
        const { images, prompt } = body;

        // Validate
        const validation = validateImages(images);
        if (!validation.valid) {
            return new Response(JSON.stringify({ error: validation.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check API key
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error('VITE_GEMINI_API_KEY not set');
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialize Gemini
        const ai = new GoogleGenAI({ apiKey });

        // Build image parts
        const imageParts = images.map(img => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        }));

        const userPrompt = prompt ||
            "Analyze these handwritten exam sheets. Extract all questions, sections, and visual elements. Output strictly as a raw JSON object following the schema. No Markdown.";

        console.log('📤 Calling Gemini API with', images.length, 'images...');

        // Call Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
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

        console.log('✅ Gemini API response received');

        return new Response(JSON.stringify({
            success: true,
            result: response.text || ''
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        return new Response(JSON.stringify({
            error: 'AI analysis failed. Please try again.'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Netlify function config
export const config = {
    path: "/api/analyze"
};
