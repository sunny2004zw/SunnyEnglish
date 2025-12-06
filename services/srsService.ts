
import { SRSData, SRSItem, Idiom } from '../types';

const STORAGE_KEY = 'toon-reader-srs';

const getTodayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const EBBINGHAUS_INTERVALS = [0, 1, 2, 4, 7, 15]; // Days

const calculateReviewDates = (startDate: number): number[] => {
  return EBBINGHAUS_INTERVALS.map(days => startDate + (days * 24 * 60 * 60 * 1000));
};

export const loadSRSData = (): SRSData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse SRS data", e);
    }
  }
  return { words: [], phrases: [] };
};

export const saveSRSData = (data: SRSData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const addWordToSRS = (word: string) => {
  const data = loadSRSData();
  const normalizedWord = word.trim().toLowerCase();
  
  // Check duplicate
  if (data.words.some(w => w.id === normalizedWord)) return;

  const today = getTodayMidnight();
  const newItem: SRSItem<string> = {
    id: normalizedWord,
    data: word, // Keep original casing preference if needed, or just use normalized
    addedDate: today,
    reviewDates: calculateReviewDates(today)
  };

  data.words.push(newItem);
  saveSRSData(data);
};

export const addPhraseToSRS = (idiom: Idiom) => {
  const data = loadSRSData();
  const normalizedPhrase = idiom.phrase.trim().toLowerCase();

  // Check duplicate
  if (data.phrases.some(p => p.id === normalizedPhrase)) return;

  const today = getTodayMidnight();
  const newItem: SRSItem<Idiom> = {
    id: normalizedPhrase,
    data: idiom,
    addedDate: today,
    reviewDates: calculateReviewDates(today)
  };

  data.phrases.push(newItem);
  saveSRSData(data);
};

export const getWordsForToday = (): { newToday: string[], reviewToday: string[] } => {
  const data = loadSRSData();
  const today = getTodayMidnight();

  const newToday = data.words
    .filter(w => w.addedDate === today)
    .map(w => w.data);

  const reviewToday = data.words
    .filter(w => w.addedDate !== today && w.reviewDates.includes(today))
    .map(w => w.data);

  return { newToday, reviewToday };
};

export const getPhrasesForToday = (): { newToday: Idiom[], reviewToday: Idiom[] } => {
  const data = loadSRSData();
  const today = getTodayMidnight();

  const newToday = data.phrases
    .filter(p => p.addedDate === today)
    .map(p => p.data);

  const reviewToday = data.phrases
    .filter(p => p.addedDate !== today && p.reviewDates.includes(today))
    .map(p => p.data);

  return { newToday, reviewToday };
};
