// Secure Gemini Service - Calls local API proxy
// API key is kept server-side only

const API_URL = '/api/analyze';
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Convert file to base64 with validation
 */
export const fileToGenerativePart = async (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      reject(new Error(`Unsupported file type: ${file.type}`));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Error classification for better user messaging
 */
type ErrorType = 'network' | 'timeout' | 'rate_limit' | 'validation' | 'server' | 'unknown';

interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
}

const classifyError = (error: unknown): ClassifiedError => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('too many requests') || msg.includes('rate limit')) {
      return { type: 'rate_limit', message: 'Too many requests. Please wait a minute and try again.', retryable: true };
    }
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return { type: 'timeout', message: 'Request timed out. Try with fewer or smaller images.', retryable: true };
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return { type: 'network', message: 'Network error. Please check your connection.', retryable: true };
    }
    if (msg.includes('validation') || msg.includes('invalid')) {
      return { type: 'validation', message: error.message, retryable: false };
    }
  }

  return { type: 'unknown', message: 'Failed to analyze exam sheet. Please try again.', retryable: true };
};

export class GeminiService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = API_URL;
  }

  async analyzeExamSheet(files: File[]): Promise<string> {
    // Validate file count
    if (files.length === 0) {
      throw new Error('Please upload at least one image');
    }
    if (files.length > 10) {
      throw new Error('Maximum 10 images allowed');
    }

    try {
      // Convert files to base64 with validation
      const images = await Promise.all(files.map(fileToGenerativePart));

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      // Call secure backend API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      return data.result || '';
    } catch (error) {
      // Classify and throw user-friendly error
      const classified = classifyError(error);
      throw new Error(classified.message);
    }
  }

  // Helper for Pollinations (Instant image generation)
  async generateLineArtPollinations(prompt: string): Promise<string | null> {
    const randomSeed = Math.floor(Math.random() * 1000);
    const enhancedPrompt = encodeURIComponent(
      `${prompt}, simple vector line art, coloring book style, black and white, white background, no shading, minimal details, educational illustration`
    );
    return `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=512&height=512&nologo=true&seed=${randomSeed}&model=flux`;
  }

  // Legacy method kept for compatibility
  async generateLineArt(prompt: string): Promise<string | null> {
    return this.generateLineArtPollinations(prompt);
  }
}

export const geminiService = new GeminiService();
