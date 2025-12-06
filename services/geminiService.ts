
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { AnalysisResult, TeacherExplanation, VocabularyItem, QuestionAnalysis, AnalyzedSentence } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CACHE ---
const vocabularyCache = new Map<string, VocabularyItem>();

// --- SCHEMAS ---

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sentences: {
      type: Type.ARRAY,
      description: "List of analyzed sentences from the text.",
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING },
          translation: { type: Type.STRING },
          idioms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                meaning: { type: Type.STRING },
                example: { type: Type.STRING },
                exampleMeaning: { type: Type.STRING },
              },
              required: ["phrase", "meaning", "example", "exampleMeaning"],
            },
          },
          segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                isWord: { type: Type.BOOLEAN },
                meaning: { type: Type.STRING, nullable: true },
                ipa: { type: Type.STRING, nullable: true },
                chunkIndex: { type: Type.INTEGER }
              },
              required: ["text", "isWord", "chunkIndex"],
            },
          },
        },
        required: ["originalText", "translation", "idioms", "segments"],
      },
    },
  },
  required: ["sentences"],
};

const explanationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    translation: { type: Type.STRING },
    structureAnalysis: { type: Type.STRING },
    chunks: { type: Type.ARRAY, items: { type: Type.STRING } },
    fixedPhrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phrase: { type: Type.STRING },
          explanation: { type: Type.STRING }
        }
      }
    },
    audioScript: { type: Type.STRING }
  },
  required: ["translation", "structureAnalysis", "chunks", "fixedPhrases", "audioScript"]
};

const vocabularySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          pos: { type: Type.STRING },
          ipa: { type: Type.STRING },
          meaning: { type: Type.STRING },
          collocations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                meaning: { type: Type.STRING }
              }
            }
          },
          verbForms: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              past: { type: Type.STRING },
              pastParticiple: { type: Type.STRING }
            }
          }
        },
        required: ["word", "pos", "ipa", "meaning", "collocations"]
      }
    }
  },
  required: ["items"]
};

const wordLookupSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ipa: { type: Type.STRING },
    meaning: { type: Type.STRING },
  },
  required: ["ipa", "meaning"],
};

const transcriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.NUMBER, description: "Start time of the sentence in seconds." },
          endTime: { type: Type.NUMBER, description: "End time of the sentence in seconds." },
          text: { type: Type.STRING, description: "The sentence text." }
        },
        required: ["startTime", "endTime", "text"]
      }
    }
  },
  required: ["segments"]
};

const questionAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctOption: { type: Type.STRING, description: "The letter of the correct answer (e.g. 'A', 'B')." },
          explanation: { type: Type.STRING, description: "Detailed explanation analyzing why the correct option is right and specifically why each distractor is wrong." }
        },
        required: ["questionId", "questionText", "options", "correctOption", "explanation"]
      }
    }
  },
  required: ["questions"]
};

// --- API FUNCTIONS ---

// 0. Extract Text from File (OCR/Text)
export const extractText = async (file: File): Promise<string> => {
  const base64Data = await fileToBase64(file);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      role: "user",
      parts: [
        { inlineData: { mimeType: file.type, data: base64Data } },
        { text: "Extract the text from this document. Return only the plain text content, preserving the original sentence structure as much as possible. Do not include page numbers or headers." }
      ]
    },
  });
  return response.text || "";
};

// 1. Standard Content Analysis (Text or Image)
export const analyzeContent = async (
  input: string | File
): Promise<AnalysisResult> => {
  
  const systemInstruction = `
    You are an expert English teacher for primary school students in China.
    Parse input to JSON.
    
    1. Break input into INDIVIDUAL SENTENCES. Do not group them into paragraphs.
    2. **Translation**: Translate the sentence into **Simplified Chinese (简体中文)**. Ensure it is natural and accurate.
    3. **Vocabulary**: Identify KET/PET level words (or words difficult for kids). For these words, provide:
       - 'meaning': The Chinese meaning.
       - 'ipa': The IPA pronunciation.
       - Populate these in the 'segments' array.
    4. **Idioms/Collocations**: Identify fixed phrases, provide Chinese meaning, simple English example, and example meaning.
    5. **Tokenization**: Segment words correctly and assign 'chunkIndex' for sense groups.

    If input is image, OCR first.
  `;

  let contentParts: any[] = [];

  if (typeof input === 'string') {
    contentParts.push({ text: input });
  } else {
    const base64Data = await fileToBase64(input);
    contentParts.push({
      inlineData: { mimeType: input.type, data: base64Data },
    });
    contentParts.push({ text: "Analyze text." });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { role: "user", parts: contentParts },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  return JSON.parse(response.text!) as AnalysisResult;
};

// 1.5 Analyze Pre-Segmented Sentences (for Listening Mode)
export const analyzePreSegmentedContent = async (
  sentences: string[]
): Promise<AnalysisResult> => {
  
  // Guard against too many sentences causing timeouts
  const MAX_BATCH_SIZE = 50;
  if (sentences.length > MAX_BATCH_SIZE) {
    // For now, just slice. In a production app, we would batch requests.
    console.warn("Input text too long, analyzing first 50 sentences only.");
    sentences = sentences.slice(0, MAX_BATCH_SIZE);
  }

  const systemInstruction = `
    You are an expert English teacher for primary school students in China.
    I will provide a JSON list of English sentences. Analyze them one by one in the exact order provided.
    
    For EACH sentence:
    1. **Translation**: Translate the sentence into **Simplified Chinese (简体中文)**. Ensure it is natural and accurate. DO NOT output Spanish or any other language.
    2. **Vocabulary Analysis**: For every word in the sentence:
       - If the word is **KET level or above** (A2+), or typically difficult for a primary school student:
         - Provide the **Chinese meaning** in the 'meaning' field.
         - Provide the **IPA pronunciation** in the 'ipa' field.
       - If the word is simple (e.g., 'the', 'is', 'a'), leave 'meaning' and 'ipa' null.
    3. **Segmentation**: Tokenize the sentence into words and punctuation ('segments').
    4. **Chunking**: Assign 'chunkIndex' to group words into sense groups (phrases).
    5. **Idioms**: Identify fixed phrases/idioms, provide their Chinese meaning, a simple English example, and the Chinese translation of the example.
    
    Return the result in the same 'sentences' array format as defined in the schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { role: "user", parts: [{ text: JSON.stringify(sentences) }] },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
    },
  });

  return JSON.parse(response.text!) as AnalysisResult;
};

// 2. Audio Transcription with Timestamps
export const transcribeAudio = async (audioFile: File, referenceText?: string): Promise<{ text: string, segments: {start: number, end: number, text: string}[] }> => {
  const base64Data = await fileToBase64(audioFile);
  
  let prompt = "Transcribe the audio accurately. Break the transcription into SENTENCES. Return a list where each item is a sentence with its start/end timestamp.";
  if (referenceText) {
    prompt += `\n\nALIGNMENT INSTRUCTION: Use the following text as the GROUND TRUTH. 
    You must align the audio to these exact sentences. 
    Reference Text: "${referenceText.substring(0, 5000)}"`; // Limit reference text to avoid token limits
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      role: "user",
      parts: [
        { inlineData: { mimeType: audioFile.type, data: base64Data } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: transcriptionSchema,
    },
  });

  if (!response.text) {
     throw new Error("No transcription received.");
  }

  const result = JSON.parse(response.text!);
  const segments = result.segments.map((s: any) => ({
    start: s.startTime,
    end: s.endTime,
    text: s.text
  }));
  const fullText = segments.map((s: any) => s.text).join(' ');
  
  return { text: fullText, segments };
};

// 3. Listening Question Analysis
export const analyzeQuestions = async (imageFile: File, transcript: string): Promise<QuestionAnalysis[]> => {
  const base64Data = await fileToBase64(imageFile);

  // Truncate transcript if excessively long to prevent RPC errors
  const safeTranscript = transcript.length > 20000 ? transcript.slice(0, 20000) + "..." : transcript;

  const prompt = `
    Here is an image containing listening comprehension questions and the transcript of the audio.
    1. Identify each question and its options.
    2. Based on the transcript provided below, determine the correct answer.
    3. Provide a DETAILED explanation in Chinese. Go through each option (A, B, C...) and explain WHY the correct one is correct (citing specific parts of the transcript) and WHY the others are wrong.
    
    Transcript:
    "${safeTranscript}"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      role: "user",
      parts: [
        { inlineData: { mimeType: imageFile.type, data: base64Data } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: questionAnalysisSchema,
    },
  });

  const result = JSON.parse(response.text!);
  return result.questions as QuestionAnalysis[];
};

export const explainSentence = async (sentence: string): Promise<TeacherExplanation> => {
  const prompt = `Act as a friendly English primary school teacher in China. Explain: "${sentence}".
  1. Translation (Chinese).
  2. Simple structure analysis (Chinese).
  3. Sense groups.
  4. Fixed phrases (Chinese explanation).
  5. Audio script (friendly explanation in Chinese/English mix).`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: explanationSchema }
  });
  return JSON.parse(response.text!) as TeacherExplanation;
};

export const generateVocabularyList = async (words: string[]): Promise<VocabularyItem[]> => {
  // Filter out words already in cache
  const uncachedWords = words.filter(w => !vocabularyCache.has(w.toLowerCase()));
  
  let newItems: VocabularyItem[] = [];

  if (uncachedWords.length > 0) {
    const prompt = `Vocabulary teacher. For words: ${uncachedWords.join(', ')}. 
    Return a structured list including:
    - 'word': The word itself.
    - 'pos': Part of speech (e.g. 'noun', 'verb'). IMPORTANT: If it is a verb, include specific form if relevant in 'pos' string, AND MUST populate 'verbForms' object.
    - 'ipa': IPA pronunciation.
    - 'meaning': Chinese meaning (KET/PET level).
    - 'collocations': A list of common English collocations/phrases containing this word. Return them as objects with 'phrase' (the English phrase) and 'meaning' (Chinese meaning).
    - 'verbForms': If the word is a VERB, you MUST provide 'past' (past tense) and 'pastParticiple'. If not a verb, this can be null.
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: vocabularySchema }
    });
    newItems = JSON.parse(response.text!).items as VocabularyItem[];
    
    // Add to cache
    newItems.forEach(item => {
      vocabularyCache.set(item.word.toLowerCase(), item);
    });
  }

  // Return full list from cache
  return words.map(w => vocabularyCache.get(w.toLowerCase())!).filter(Boolean);
};

export const lookupWord = async (word: string): Promise<{ ipa: string; meaning: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `IPA and concise Chinese meaning for "${word}".`,
    config: { responseMimeType: "application/json", responseSchema: wordLookupSchema },
  });
  return JSON.parse(response.text!);
};

export const generateAudio = async (text: string): Promise<string> => {
  return generateDocumentAudio(text, 'US');
};

export const generateDocumentAudio = async (text: string, accent: 'US' | 'UK'): Promise<string> => {
    const voiceName = accent === 'UK' ? 'Fenrir' : 'Kore';
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
