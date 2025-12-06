import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import Button from './components/Button';
import SentenceCard from './components/SentenceCard';
import ImmersiveReader from './components/ImmersiveReader';
import ListeningPlayer from './components/ListeningPlayer';
import ListeningTranscript from './components/ListeningTranscript';
import QuestionAnalysisSection from './components/QuestionAnalysis';
import RecitationModule from './components/RecitationModule';
import { analyzeContent, generateVocabularyList, transcribeAudio, analyzeQuestions, extractText, analyzePreSegmentedContent } from './services/geminiService';
import { addWordToSRS, addPhraseToSRS } from './services/srsService';
import { AnalysisResult, AppState, HistoryItem, WordSegment, Idiom } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [mode, setMode] = useState<'READING' | 'LISTENING'>('READING');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // File Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  
  // Previews & Files
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  
  // Text Input State
  const [inputText, setInputText] = useState('');
  
  // Immersive Reader State
  const [showImmersive, setShowImmersive] = useState(false);
  const [immersiveAccent, setImmersiveAccent] = useState<'US' | 'UK'>('US');

  // Listening Mode State
  const [currentAudioTime, setCurrentAudioTime] = useState(0);

  // Vocabulary Loading State
  const [isGeneratingWords, setIsGeneratingWords] = useState(false);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('toon-reader-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [previewUrl, audioPreviewUrl]);

  const saveToHistory = (data: AnalysisResult) => {
    const firstSentence = data.sentences[0]?.originalText || data.sentences[0]?.segments.map(s => s.text).join(' ') || 'Untitled Analysis';
    const title = (mode === 'LISTENING' ? '🎧 ' : '📖 ') + (firstSentence.length > 50 ? firstSentence.slice(0, 50) + '...' : firstSentence);
    
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      title,
      data
    };

    const updatedHistory = [newItem, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('toon-reader-history', JSON.stringify(updatedHistory));
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('toon-reader-history', JSON.stringify(updatedHistory));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setPreviewUrl(null);
    setAudioPreviewUrl(null);
    setResult(item.data);
    setAppState(AppState.SUCCESS);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to extract and save words/phrases to SRS
  const autoSaveToSRS = (data: AnalysisResult) => {
    // 1. Extract Words (Segments that have a meaning, indicating they are KET+)
    const words = new Set<string>();
    data.sentences.forEach(sent => {
      sent.segments.forEach(seg => {
        if (seg.isWord && seg.meaning) {
          // Clean the word (remove punctuation if any attached, though segments usually split it)
          const cleanWord = seg.text.replace(/[^a-zA-Z]/g, '');
          if (cleanWord.length > 1) {
            words.add(cleanWord);
          }
        }
      });
      // 2. Extract Phrases
      sent.idioms.forEach(idiom => {
        addPhraseToSRS(idiom);
      });
    });

    words.forEach(word => {
      addWordToSRS(word);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (mode === 'READING') {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      processContent(file);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert("Audio file is too large! Please upload a file smaller than 20MB.");
        return;
      }
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTranscriptFile(file);
    }
  };

  const handleQuestionImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQuestionFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (mode === 'LISTENING') return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          processContent(blob);
          return;
        }
      }
    }
  };

  const handleTextAnalyze = () => {
    if (inputText.trim()) {
      processContent(inputText);
    }
  };

  // READING MODE PIPELINE
  const processContent = async (content: File | string) => {
    setAppState(AppState.ANALYZING);
    setError(null);
    try {
      const data = await analyzeContent(content);
      setResult(data);
      saveToHistory(data);
      autoSaveToSRS(data); // Auto-save to Ebbinghaus module
      setAppState(AppState.SUCCESS);
    } catch (err: any) {
      setError(err.message || "Something went wrong! Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  // LISTENING MODE PIPELINE
  const processListening = async () => {
    if (!audioFile) {
      alert("Please upload an audio file first.");
      return;
    }

    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      let referenceText = "";
      
      // 1. Extract Text from Transcript File (if provided)
      if (transcriptFile) {
        try {
          referenceText = await extractText(transcriptFile);
          console.log("Extracted Reference Text:", referenceText.slice(0, 50) + "...");
        } catch (e) {
          console.warn("Transcript extraction failed", e);
        }
      }

      // 2. Transcribe Audio (Get Segments + Timestamps)
      const { text: fullTranscript, segments } = await transcribeAudio(audioFile, referenceText);
      
      if (!segments || segments.length === 0) {
        throw new Error("Could not transcribe audio. Please check the audio file.");
      }

      // 3. Deep Analysis of the Content
      const sentenceList = segments.map(s => s.text);
      const analysisData = await analyzePreSegmentedContent(sentenceList);

      // 4. Merge Timestamps into Analysis Result
      const mergedSentences = analysisData.sentences.map((sent, idx) => {
         const ts = segments[idx]; // Map by index
         return {
           ...sent,
           startTime: ts ? ts.start : undefined,
           endTime: ts ? ts.end : undefined,
         };
      });
      analysisData.sentences = mergedSentences;

      // 5. Analyze Questions (if provided)
      if (questionFile) {
        try {
          const questionData = await analyzeQuestions(questionFile, fullTranscript);
          analysisData.questions = questionData;
        } catch (e) {
          console.warn("Question analysis failed", e);
        }
      }

      setResult(analysisData);
      saveToHistory(analysisData);
      autoSaveToSRS(analysisData); // Auto-save to Ebbinghaus module
      setAppState(AppState.SUCCESS);

    } catch (err: any) {
      console.error(err);
      let msg = "Listening analysis failed.";
      if (err.message?.includes("Rpc failed")) {
        msg += " The server connection timed out or the file is too large. Please try a shorter audio clip.";
      } else {
        msg += " " + (err.message || "Please check your files and try again.");
      }
      setError(msg);
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setResult(null);
    setPreviewUrl(null);
    setInputText('');
    setAudioFile(null);
    setTranscriptFile(null);
    setQuestionFile(null);
    setAudioPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (transcriptInputRef.current) transcriptInputRef.current.value = '';
    if (questionImageInputRef.current) questionImageInputRef.current.value = '';
  };

  const openImmersiveReader = (accent: 'US' | 'UK') => {
    setImmersiveAccent(accent);
    setShowImmersive(true);
  };

  const handleSeek = (time: number) => {
    const audio = document.querySelector('audio');
    if (audio) {
      audio.currentTime = time;
    }
  };

  const openPrintWindow = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to download/print the PDF.");
      return;
    }
    
    // Add date for the header
    const dateStr = new Date().toLocaleString();

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; max-width: 900px; margin: 0 auto; }
            .header-container { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #FFD93D; margin-bottom: 20px; padding-bottom: 10px; }
            h1 { text-align: center; color: #222; margin: 0; font-size: 32px; flex-grow: 1; }
            .date { font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th, td { border: 1px solid #e5e7eb; padding: 12px 16px; text-align: left; vertical-align: top; }
            th { background-color: #f9fafb; font-weight: bold; text-transform: uppercase; font-size: 12px; color: #1f2937; letter-spacing: 0.05em; }
            tr:nth-child(even) { background-color: #fff; }
            tr:nth-child(odd) { background-color: #fff; }
            /* Specific column widths for better layout */
            th:first-child { width: 20%; } 
            
            .ipa { color: #6b7280; font-family: 'Courier New', monospace; font-size: 0.9em; display: block; margin-top: 4px; }
            .pos-tag { color: #00838f; font-weight: bold; font-size: 13px; }
            .meaning { color: #111; font-weight: 500; }
            .example-en { display: block; margin-bottom: 4px; color: #111; }
            .example-cn { display: block; color: #666; font-size: 12px; }
            
            @media print { body { padding: 0; } button { display: none; } table { width: 100%; } }
          </style>
        </head>
        <body>
          <div class="header-container">
             <span class="date">${dateStr}</span>
             <h1>${title}</h1>
          </div>
          ${content}
          <script>window.onload = () => { setTimeout(() => window.print(), 500); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadFullPDF = () => {
    if (!result) return;
     const cardsHtml = result.sentences.map((sent, index) => {
      const chunks: WordSegment[][] = [];
      if (sent.segments.length > 0) {
        let currentChunkIndex = sent.segments[0].chunkIndex;
        let currentGroup: WordSegment[] = [];
        sent.segments.forEach((seg) => {
          if (seg.chunkIndex !== undefined && seg.chunkIndex !== currentChunkIndex) {
            chunks.push(currentGroup);
            currentGroup = [];
            currentChunkIndex = seg.chunkIndex;
          }
          currentGroup.push(seg);
        });
        if (currentGroup.length > 0) chunks.push(currentGroup);
      }
      const chunksHtml = chunks.map(chunk => `
        <div class="relative flex items-baseline gap-1">
           <div class="absolute -bottom-2 left-0 right-0 h-3 border-b-2 border-l-2 border-r-2 border-gray-300 rounded-b-lg opacity-50"></div>
           ${chunk.map(seg => `
            <div class="relative flex flex-col items-center">
              ${(seg.isWord && seg.meaning) ? `<span class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 text-xs text-white font-bold whitespace-nowrap bg-toon-blue px-2 py-1 rounded-lg z-20">${seg.meaning}</span>` : ''}
              <span class="text-2xl font-bold text-gray-800 z-10 ${(seg.isWord && seg.meaning) ? 'border-b-2 border-toon-blue/30 border-dashed pb-0.5' : ''}">${seg.text}</span>
              ${(seg.isWord && seg.ipa) ? `<span class="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-mono">/${seg.ipa}/</span>` : ''}
            </div>
           `).join('')}
        </div>
      `).join('');
      
      let idiomsHtml = '';
      if (sent.idioms && sent.idioms.length > 0) {
        idiomsHtml = `<div class="mt-6 pl-4 border-l-4 border-toon-green"><h4>Key Phrases</h4>${sent.idioms.map(i => `<div><b>${i.phrase}</b>: ${i.meaning}</div>`).join('')}</div>`;
      }

      return `<div class="mb-8 w-full break-inside-avoid pb-8 border-b-2 border-dashed border-gray-200">
        <div class="absolute top-1 left-0 w-8 h-8 bg-toon-red text-white font-black text-lg flex items-center justify-center rounded-full">${index + 1}</div>
        <div class="pl-12"><div class="flex flex-wrap gap-x-6 gap-y-16 mb-4 items-end leading-loose pt-2">${chunksHtml}</div><div class="mb-2 pl-4"><p class="text-gray-700 font-bold border-l-4 border-toon-yellow pl-3 text-lg">${sent.translation}</p></div>${idiomsHtml}</div>
      </div>`;
    }).join('');
    
    let contentHtml = cardsHtml;

    if (result.questions) {
      const quizHtml = result.questions.map((q, i) => `
        <div class="break-inside-avoid mb-6 p-4 border-2 border-black rounded-xl">
          <h3>Q${i+1}: ${q.questionText}</h3>
          <ul>${q.options.map(o => `<li class="${o.startsWith(q.correctOption) ? 'correct' : ''}">${o}</li>`).join('')}</ul>
          <div class="explanation">TEACHER: ${q.explanation}</div>
        </div>
      `).join('');
      contentHtml += `<h2 style="margin-top:40px; text-align:center; border-top: 3px solid black; padding-top: 20px;">🎧 Listening Quiz Analysis</h2>${quizHtml}`;
    }

    const printWindow = window.open('', '_blank');
    if(printWindow) {
      printWindow.document.write(`<html><head><title>Full PDF</title><script src="https://cdn.tailwindcss.com"></script><style>body{padding:40px;font-family:sans-serif;} @media print{.break-inside-avoid{break-inside:avoid;}}</style></head><body><div class="max-w-4xl mx-auto">${contentHtml}</div><script>setTimeout(()=>window.print(),1000)</script></body></html>`);
      printWindow.document.close();
    }
  };

  const handleDownloadPhrasesPDF = () => {
      if (!result) return;
      let sentIdioms: Idiom[] = [];
      result.sentences.forEach(s => s.idioms?.forEach(i => sentIdioms.push(i)));
      generatePhrasesPDF(sentIdioms, "Phrases");
  };

  // Reusable function for generating phrases PDF from a list of Idioms
  const generatePhrasesPDF = (idioms: Idiom[], title: string) => {
    const rows = idioms.map(i => `
      <tr>
        <td style="font-weight:bold">${i.phrase}</td>
        <td class="meaning">${i.meaning}</td>
        <td>
          <span class="example-en">${i.example}</span>
          <span class="example-cn">${i.exampleMeaning || ''}</span>
        </td>
      </tr>
    `).join('');
    
    openPrintWindow(title, `
      <table>
        <thead>
          <tr>
            <th>PHRASE</th>
            <th>MEANING</th>
            <th>EXAMPLE</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `);
  };

  // Reusable function for generating words PDF from a list of strings
  const generateWordsPDF = async (wordList: any[], title: string) => {
     if(wordList.length === 0) return alert("No words found.");
     setIsGeneratingWords(true);
     try {
       const list = await generateVocabularyList(wordList);
       const rows = list.map(i => {
         const collocationsHtml = i.collocations.map(c => 
           `<div><span style="font-weight:500">${c.phrase}</span> <span style="color:#666;font-size:0.9em">${c.meaning}</span></div>`
         ).join('');
         
         let posHtml = `<span class="pos-tag">${i.pos}</span>`;
         if (i.verbForms && (i.verbForms.past || i.verbForms.pastParticiple)) {
             posHtml += `<div style="font-size:0.8em; color:#555; margin-top:4px;">
               ${i.verbForms.past ? `Past: ${i.verbForms.past}<br/>` : ''}
               ${i.verbForms.pastParticiple ? `PP: ${i.verbForms.pastParticiple}` : ''}
             </div>`;
         }

         return `
         <tr>
           <td>
             <b>${i.word}</b>
             <span class="ipa">//${i.ipa}//</span>
           </td>
           <td>${posHtml}</td>
           <td class="meaning">${i.meaning}</td>
           <td>${collocationsHtml}</td>
         </tr>
       `}).join('');
       
       openPrintWindow(title, `
         <table>
           <thead>
             <tr>
               <th>WORD</th>
               <th>POS</th>
               <th>MEANING</th>
               <th>COLLOCATIONS</th>
             </tr>
           </thead>
           <tbody>
             ${rows}
           </tbody>
         </table>
       `);
     } catch (e) {
       console.error(e);
       alert("Failed to generate vocabulary list.");
     } finally {
       setIsGeneratingWords(false);
     }
  };

  const handleDownloadWordsPDF = async () => {
     if (!result) return;
     const words = Array.from(new Set(result.sentences.flatMap(s => s.segments).filter(s => s.isWord && s.meaning).map(s => s.text.replace(/[^a-zA-Z]/g,'').toLowerCase()))).filter(w => w.length > 1);
     generateWordsPDF(words, "Vocabulary");
  };

  return (
    <div className="min-h-screen pb-20 font-sans">
      <Header />
      <main className="container mx-auto px-4 flex flex-col items-center">
        
        {/* MODE SWITCHER */}
        {appState === AppState.IDLE && (
          <div className="flex bg-white rounded-full p-2 border-4 border-black shadow-toon mb-8 gap-2">
            <button 
              onClick={() => { setMode('READING'); resetApp(); }}
              className={`px-6 py-2 rounded-full font-black transition-all ${mode === 'READING' ? 'bg-toon-yellow text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              📖 Reading
            </button>
            <button 
              onClick={() => { setMode('LISTENING'); resetApp(); }}
              className={`px-6 py-2 rounded-full font-black transition-all ${mode === 'LISTENING' ? 'bg-toon-green text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🎧 Listening
            </button>
          </div>
        )}

        {/* INPUT SECTION */}
        {appState === AppState.IDLE && (
          <div className="w-full max-w-2xl flex flex-col gap-8 animate-fade-in-up items-center">
            
            {/* READING MODE UI */}
            {mode === 'READING' && (
              <div className="bg-white border-4 border-black rounded-3xl shadow-toon p-8 text-center w-full">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Reading Analysis</h2>
                <div className="border-4 border-dashed border-gray-300 bg-gray-50 rounded-2xl p-8 mb-6 flex flex-col items-center justify-center gap-4 hover:bg-yellow-50 hover:border-toon-yellow transition-colors cursor-pointer"
                     onClick={() => fileInputRef.current?.click()}>
                  <div className="text-6xl">📸</div>
                  <p className="text-xl font-bold text-gray-500">Upload Text/Image</p>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.txt" onChange={handleFileUpload} />
                </div>
                <div className="flex items-center gap-4 my-6">
                  <div className="h-0.5 bg-gray-200 flex-1"></div><span className="text-gray-400 font-bold bg-white px-2">OR</span><div className="h-0.5 bg-gray-200 flex-1"></div>
                </div>
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onPaste={handlePaste} placeholder="Paste text or image..." className="w-full h-32 p-4 rounded-xl border-4 border-black bg-gray-50 resize-none" />
                <div className="flex justify-center mt-4"><Button onClick={handleTextAnalyze} disabled={!inputText.trim()}>🚀 Analyze</Button></div>
              </div>
            )}

            {/* LISTENING MODE UI */}
            {mode === 'LISTENING' && (
              <div className="bg-white border-4 border-black rounded-3xl shadow-toon p-8 w-full">
                <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Listening Lab</h2>
                
                {/* 1. Audio Upload */}
                <div className="mb-4">
                  <label className="block font-black text-gray-700 mb-2">1. Upload Audio (Required)</label>
                  <div className={`border-4 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${audioFile ? 'bg-green-50 border-toon-green' : 'bg-gray-50 border-gray-300'}`} onClick={() => audioInputRef.current?.click()}>
                    <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                    {audioFile ? (
                      <div className="text-toon-green font-bold text-lg">🎵 {audioFile.name}</div>
                    ) : (
                      <div className="text-gray-400 font-bold">Select MP3/WAV...</div>
                    )}
                  </div>
                </div>

                {/* 2. Transcript Upload */}
                <div className="mb-4">
                  <label className="block font-black text-gray-700 mb-2">2. Upload Transcript (Optional but Recommended)</label>
                  <div className={`border-4 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${transcriptFile ? 'bg-yellow-50 border-toon-yellow' : 'bg-gray-50 border-gray-300'}`} onClick={() => transcriptInputRef.current?.click()}>
                    <input type="file" ref={transcriptInputRef} className="hidden" accept="image/*,.txt,.pdf" onChange={handleTranscriptUpload} />
                    {transcriptFile ? (
                      <div className="text-toon-yellow-dark font-bold text-lg">📜 {transcriptFile.name}</div>
                    ) : (
                      <div className="text-gray-400 font-bold">Select Script Image/Doc...</div>
                    )}
                  </div>
                </div>

                {/* 3. Questions Upload */}
                <div className="mb-8">
                  <label className="block font-black text-gray-700 mb-2">3. Upload Questions (Optional)</label>
                  <div className={`border-4 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${questionFile ? 'bg-blue-50 border-toon-blue' : 'bg-gray-50 border-gray-300'}`} onClick={() => questionImageInputRef.current?.click()}>
                    <input type="file" ref={questionImageInputRef} className="hidden" accept="image/*" onChange={handleQuestionImageUpload} />
                    {questionFile ? (
                      <div className="text-toon-blue font-bold text-lg">🖼️ {questionFile.name}</div>
                    ) : (
                      <div className="text-gray-400 font-bold">Select Questions Image...</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button onClick={processListening} disabled={!audioFile} variant="accent" className="w-full text-lg">
                    🎧 Start Analysis
                  </Button>
                </div>
              </div>
            )}
            
            {/* History List */}
             {history.length > 0 && (
              <div className="bg-white border-4 border-black rounded-3xl shadow-toon p-6 w-full">
                 <h3 className="text-2xl font-black text-gray-800 mb-4">History</h3>
                 <div className="grid gap-2">
                   {history.map((item) => (
                     <div key={item.id} onClick={() => loadFromHistory(item)} className="p-3 bg-gray-50 border-2 border-gray-200 rounded-lg hover:bg-yellow-100 cursor-pointer flex justify-between">
                       <span className="font-bold">{item.title}</span>
                       <button onClick={(e) => deleteHistoryItem(e, item.id)}>✕</button>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            {/* SRS RECITATION MODULE (Only in IDLE) */}
            <RecitationModule 
              onDownloadWords={generateWordsPDF}
              onDownloadPhrases={generatePhrasesPDF}
              isGeneratingWords={isGeneratingWords}
            />

          </div>
        )}

        {/* LOADING & ERROR */}
        {appState === AppState.ANALYZING && (
          <div className="text-center p-12"><div className="w-20 h-20 border-8 border-toon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><h3 className="text-2xl font-black">Analyzing...</h3></div>
        )}
        {appState === AppState.ERROR && (
           <div className="bg-red-100 border-4 border-red-500 p-8 rounded-2xl text-center"><p className="text-red-700 font-bold mb-4">{error}</p><Button onClick={resetApp}>Try Again</Button></div>
        )}

        {/* RESULTS */}
        {appState === AppState.SUCCESS && result && (
          <div className="w-full flex flex-col items-center animate-fade-in">
             <div className="w-full max-w-4xl flex justify-between mb-6">
                <Button variant="secondary" onClick={resetApp}>⬅ Back</Button>
                {/* Read All Buttons */}
                {mode === 'READING' && (
                  <div className="flex gap-2">
                    <Button onClick={() => openImmersiveReader('US')}>🇺🇸 Read</Button>
                    <Button onClick={() => openImmersiveReader('UK')}>🇬🇧 Read</Button>
                  </div>
                )}
             </div>

             {/* PART 1: LISTENING TRANSCRIPT VIEW */}
             {mode === 'LISTENING' && (
               <ListeningTranscript 
                 sentences={result.sentences} 
                 currentTime={currentAudioTime} 
                 onSeek={handleSeek}
               />
             )}

             {/* PART 2: DETAILED SENTENCE ANALYSIS */}
             {mode === 'LISTENING' && (
               <div className="w-full max-w-4xl mb-8 flex items-center gap-4">
                 <div className="bg-toon-yellow text-black p-2 rounded-lg border-4 border-black shadow-toon-sm rotate-2">
                   <span className="text-2xl font-black">🔬</span>
                 </div>
                 <h2 className="text-3xl font-black text-gray-800">
                   Detailed Analysis
                 </h2>
               </div>
             )}

             <div className="w-full flex flex-col items-center">
                {result.sentences.map((sentence, index) => {
                  // Only highlight in Reading mode or if scrolled into view in Listening mode
                  const isActive = mode === 'LISTENING' && 
                                   currentAudioTime >= (sentence.startTime || 0) && 
                                   currentAudioTime < (sentence.endTime || 99999);
                  
                  let progress = 0;
                  if (isActive && sentence.startTime !== undefined && sentence.endTime !== undefined) {
                    const duration = sentence.endTime - sentence.startTime;
                    if (duration > 0) {
                      progress = Math.min(Math.max((currentAudioTime - sentence.startTime) / duration, 0), 1);
                    }
                  }

                  return (
                    <div key={index} id={`sentence-${index}`} className={`transition-all duration-300 w-full max-w-4xl`}>
                      <SentenceCard sentence={sentence} index={index} isActive={isActive} progress={progress} />
                    </div>
                  );
                })}
             </div>

             {/* Questions Analysis Section */}
             {result.questions && <QuestionAnalysisSection questions={result.questions} />}

             {/* Downloads */}
             <div className="mt-8 flex flex-wrap justify-center gap-4 mb-32">
                <Button onClick={handleDownloadFullPDF}>📄 Full PDF</Button>
                <Button onClick={handleDownloadPhrasesPDF}>🗝️ Phrases PDF</Button>
                <Button onClick={handleDownloadWordsPDF} disabled={isGeneratingWords}>{isGeneratingWords ? '...' : '📖 Words PDF'}</Button>
             </div>
          </div>
        )}

        {/* OVERLAYS */}
        {showImmersive && result && <ImmersiveReader data={result} accent={immersiveAccent} onClose={() => setShowImmersive(false)} />}
        
        {/* LISTENING PLAYER (Sticky Bottom) */}
        {mode === 'LISTENING' && audioPreviewUrl && appState === AppState.SUCCESS && (
          <ListeningPlayer audioUrl={audioPreviewUrl} onTimeUpdate={(t) => {
             setCurrentAudioTime(t);
             // Auto-scroll logic is now handled more gently or removed to prevent jumping while reading Part 1
             // We can rely on Part 1 for tracking, so no forced scroll here to improve UX.
          }} />
        )}

      </main>
    </div>
  );
};

export default App;