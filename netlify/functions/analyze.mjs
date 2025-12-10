import { GoogleGenAI } from '@google/genai';

// Full system prompt for OCR
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

// Main handler - Netlify Functions format
export async function handler(event, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
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
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { images, prompt } = body;

        // Validate images
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
            console.error('ERROR: VITE_GEMINI_API_KEY environment variable not set');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Initialize Gemini client
        const ai = new GoogleGenAI({ apiKey });

        // Build image parts for Gemini
        const imageParts = images.map(img => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        }));

        const userPrompt = prompt ||
            "Analyze these handwritten exam sheets. Extract all questions, sections, and visual elements. Output the result strictly as a raw JSON object following the defined schema. Do not use Markdown formatting.";

        console.log(`[analyze] Processing ${images.length} image(s)...`);

        // Call Gemini API
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

        console.log('[analyze] Gemini response received successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                result: response.text || ''
            })
        };

    } catch (error) {
        console.error('[analyze] Error:', error.message);
        console.error('[analyze] Stack:', error.stack);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'AI analysis failed. Please try again.'
            })
        };
    }
}
