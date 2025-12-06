
export interface WordSegment {
  text: string;
  meaning?: string; // Optional annotation for KET+ words
  ipa?: string;     // IPA pronunciation for KET+ words
  isWord: boolean;  // True if it's a word, false if punctuation/space
  chunkIndex: number; // The ID of the sense group this segment belongs to
}

export interface Idiom {
  phrase: string;
  meaning: string;
  example: string; // Simple English example sentence
  exampleMeaning?: string; // Chinese translation of the example
}

export interface AnalyzedSentence {
  originalText?: string; // The full English sentence with correct spacing
  segments: WordSegment[];
  translation: string;
  idioms: Idiom[];
  // New fields for Audio Sync
  startTime?: number; // Start time in seconds
  endTime?: number;   // End time in seconds
}

export interface QuestionAnalysis {
  questionId: number;
  questionText: string;
  options: string[]; // e.g. ["A. It's blue", "B. It's red", "C. It's green"]
  correctOption: string; // e.g. "B"
  explanation: string; // Why B is right and why A/C are wrong, referencing the transcript
}

export interface ListeningAnalysisResult {
  sentences: AnalyzedSentence[];
  questions?: QuestionAnalysis[];
}

export interface AnalysisResult {
  sentences: AnalyzedSentence[];
  questions?: QuestionAnalysis[]; // merged for easier UI handling
}

export interface TeacherExplanation {
  translation: string;
  structureAnalysis: string;
  chunks: string[];
  fixedPhrases: { phrase: string; explanation: string }[];
  audioScript: string; 
}

export interface VocabularyItem {
  word: string;
  pos: string; 
  ipa: string;
  meaning: string;
  collocations: { phrase: string; meaning: string }[];
  verbForms?: {
    past: string;
    pastParticiple: string;
  };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  data: AnalysisResult;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

// --- SRS (Spaced Repetition System) Types ---

export interface SRSItem<T> {
  id: string; // unique key (word or phrase text)
  data: T;    // The actual content (string for word, Idiom object for phrase)
  addedDate: number; // Timestamp of creation (midnight)
  reviewDates: number[]; // Array of timestamps for Ebbinghaus reviews
}

export interface SRSData {
  words: SRSItem<string>[]; // Stores simple word string. Details fetched on demand/download.
  phrases: SRSItem<Idiom>[];
}
