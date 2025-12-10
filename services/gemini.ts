// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export class GeminiService {
  private apiUrl: string;

  constructor() {
    // Use local API proxy instead of direct Gemini calls
    this.apiUrl = '/api/analyze';
  }

  async analyzeExamSheet(files: File[]): Promise<string> {
    try {
      // Convert files to base64
      const images = await Promise.all(files.map(fileToGenerativePart));

      // Call our secure backend API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      const data = await response.json();
      console.log("AI Response:", data.result);
      return data.result || "";
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

