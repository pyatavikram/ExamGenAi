// src/types.ts

// --- CONFIGURATION TYPES ---
export interface SchoolConfig {
  schoolName: string;
  examName: string;
  className: string;
  subject: string;
  marks: string;
  time: string;
  date: string;
  logoUrl?: string | null;
}

// --- APP STATE TYPES ---
export enum AppState {
  IDLE,
  ANALYZING,         // Sending images to Gemini
  GENERATING_IMAGES, // (Optional) Phase if we batch generate art
  READY,
  ERROR
}

// Used to track the state of Pollinations/Gemini images in the frontend
export interface GeneratedImage {
  id: string;      // Unique ID
  prompt: string;  // The prompt string from the JSON
  url: string | null;
  loading: boolean;
}

// --- NEW CORE DATA STRUCTURE (JSON ARCHITECTURE) ---

// UPDATED: Added 'table' to support Data Tables (e.g. Rainfall data)
export type ContentType = 'text' | 'image' | 'svg' | 'table';

// UPDATED: Added 'vertical_math' to AnswerType
export type AnswerType = 'mcq' | 'grid' | 'none' | 'vertical_math'; 

export type SectionType = 'general' | 'match_following';
export type VerticalMathSubtype = 'stack' | 'division';

/**
 * NEW: Structure for the reference object inside a content part
 * This handles the diagrams attached to a specific question text
 */
export interface ReferenceContent {
    type: 'image' | 'svg';
    value: string; // The prompt for image OR the raw SVG code string
}

/**
 * NEW: Structure for Data Tables inside questions
 */
export interface TableData {
  headers: string[]; // e.g. ["Year", "Rainfall"]
  rows: string[][];  // e.g. [ ["2001", "763"], ["2002", "605"] ]
}

/**
 * Represents a single piece of content. 
 * Can be a text string, a prompt for an image, or a table.
 */
export interface ContentPart {
  type: ContentType;
  value: string; 
  
  // Optional reference diagram associated with this content part
  // e.g. The text is "Find area of:" and reference is the SVG of a rectangle
  reference?: ReferenceContent;

  // NEW: Optional Table Data (Only used if type === 'table')
  table_data?: TableData;
}

/**
 * Configuration for Grid/Box answers (e.g., Write 1-50)
 */
export interface GridConfig {
  rows: number;
  cols: number;
}

/**
 * Specific structure for Match The Following questions
 */
export interface MatchColumns {
  column_a: ContentPart[];
  column_b: ContentPart[];
}

/**
 * Represents a single Question (Bit).
 */
export interface MatchPair {
  left: ContentPart;
  right: ContentPart;
}

/**
 * Configuration for Vertical Math (Add, Sub, Mul, Div)
 */
export interface VerticalMathConfig {
  subtype: VerticalMathSubtype;
  
  // For 'stack' (Addition, Subtraction, Multiplication)
  operator?: string;  // "+", "-", "x"
  values?: string[];  // ["482", "213"] -> Top number, Bottom number(s)
  
  // For 'division'
  dividend?: string;  // The number inside the bracket
  divisor?: string;   // The number outside
}

export interface Question {
  id?: string;
  question_number: string;
  
  content_parts: ContentPart[]; // For standard questions
  answer_type: AnswerType;
  
  options?: ContentPart[]; // For MCQs
  grid_config?: GridConfig; // For Grids
  
  // Row-based matching structure
  match_pair?: MatchPair; 
  
  // Vertical Math Configuration
  vertical_math_config?: VerticalMathConfig;

  marks?: string;
  answer_lines?: number; // Count of lines provided for the answer (0 if none)
}

/**
 * Represents a Section (Bit/Heading) like "I. Answer the following"
 */
export interface ExamSection {
  id: string; // Frontend generated UUID
  heading: string;
  marks: string; // "10M"
  section_type: SectionType;
  questions: Question[];
}

/**
 * The Root Object that App.tsx will hold in state
 */
export interface ExamPaperData {
  sections: ExamSection[];
}