import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  }

  async analyzeExamSheet(files: File[]): Promise<string> {
    try {
      const imageParts = await Promise.all(files.map(fileToGenerativePart));

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro', // Flash is better for large context/JSON tasks
        contents: {
            parts: [
                ...imageParts,
                // UPDATED: Explicitly ask for JSON matching our schema
                { text: "Analyze these handwritten exam sheets. Extract all questions, sections, and visual elements. Output the result strictly as a raw JSON object following the defined schema. Do not use Markdown formatting." },
            ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.0, 
          responseMimeType: "application/json" 
        },
      });
      console.log("AI Response:", response.text);
      return response.text || "";
    } catch (error) {
      console.error("Error analyzing exam sheet:", error);
      throw new Error("Failed to analyze exam sheet. Please try again.");
    }
  }

  // Helper for Pollinations (Instant)
  async generateLineArtPollinations(prompt: string): Promise<string | null> {
    const randomSeed = Math.floor(Math.random() * 1000);
    const enhancedPrompt = encodeURIComponent(
      `${prompt}, simple vector line art, coloring book style, black and white, white background, no shading, minimal details, educational illustration`
    );
    return `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=512&height=512&nologo=true&seed=${randomSeed}&model=flux`;
  }

  // Legacy method kept for compatibility if needed, but Pollinations is preferred
  async generateLineArt(prompt: string): Promise<string | null> {
    return this.generateLineArtPollinations(prompt);
  }
}

export const geminiService = new GeminiService();