
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnalyzedSentence, TeacherExplanation, WordSegment } from '../types';
import { generateAudio, explainSentence } from '../services/geminiService';
import { decode, decodePCM } from '../services/audioUtils';

interface SentenceCardProps {
  sentence: AnalyzedSentence;
  index: number;
  isActive?: boolean;
  progress?: number; // 0 to 1, representing progress through the sentence duration
}

const SentenceCard: React.FC<SentenceCardProps> = ({ sentence, index, isActive = false, progress = 0 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isExplanationPlaying, setIsExplanationPlaying] = useState(false);
  const [explanation, setExplanation] = useState<TeacherExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  
  // Ref to hold the current audio source to allow stopping it
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);

  // Group segments by chunkIndex
  const chunks = useMemo(() => {
    const grouped: WordSegment[][] = [];
    if (!sentence.segments.length) return grouped;
    
    let currentChunkIndex = sentence.segments[0].chunkIndex;
    let currentGroup: WordSegment[] = [];

    sentence.segments.forEach((seg) => {
      if (seg.chunkIndex !== undefined && seg.chunkIndex !== currentChunkIndex) {
        grouped.push(currentGroup);
        currentGroup = [];
        currentChunkIndex = seg.chunkIndex;
      }
      currentGroup.push(seg);
    });
    if (currentGroup.length > 0) grouped.push(currentGroup);
    
    return grouped;
  }, [sentence.segments]);

  // Robustly reconstruct text with spacing
  const fullText = sentence.originalText || sentence.segments.map(s => s.text).join(' ').replace(/\s+([.,!?;:'])/g, '$1');

  // Helper to estimate current word index based on progress
  const activeWordIndex = useMemo(() => {
    if (!isActive || progress <= 0) return -1;
    const words = sentence.segments.filter(s => s.isWord);
    const totalChars = words.reduce((sum, w) => sum + w.text.length, 0);
    let charCount = 0;
    const wordTarget = progress * totalChars;
    
    for (let i = 0; i < words.length; i++) {
      charCount += words[i].text.length;
      if (charCount >= wordTarget) return i;
    }
    return words.length - 1;
  }, [isActive, progress, sentence.segments]);

  let wordCounter = 0; // To track index across chunks

  const stopAudio = () => {
    if (currentAudioSource.current) {
      currentAudioSource.current.stop();
      currentAudioSource.current = null;
    }
    setIsPlaying(false);
    setIsExplanationPlaying(false);
  };

  const playRawAudio = async (base64Data: string, onStart: () => void, onEnd: () => void) => {
    stopAudio();
    onStart();

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const pcmBytes = decode(base64Data);
      const audioBuffer = decodePCM(pcmBytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      currentAudioSource.current = source;
      
      source.onended = () => {
        onEnd();
        currentAudioSource.current = null;
      };
      
      source.start(0);
    } catch (error) {
      console.error("Audio playback error", error);
      onEnd();
      alert("Audio failed to play.");
    }
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    try {
      const base64Audio = await generateAudio(fullText);
      playRawAudio(
        base64Audio, 
        () => setIsPlaying(true), 
        () => setIsPlaying(false)
      );
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
    }
  };

  const handleExplain = async () => {
    if (isExplaining) {
      setIsExplaining(false);
      stopAudio();
      return;
    }
    
    setIsExplaining(true);
    
    if (!explanation) {
      setLoadingExplanation(true);
      try {
        const data = await explainSentence(fullText);
        setExplanation(data);
        if (data.audioScript) {
           const audioData = await generateAudio(data.audioScript);
           playRawAudio(
             audioData,
             () => setIsExplanationPlaying(true),
             () => setIsExplanationPlaying(false)
           );
        }
      } catch (e) {
        console.error(e);
        setIsExplaining(false);
      } finally {
        setLoadingExplanation(false);
      }
    } else {
      if (explanation?.audioScript) {
        const audioData = await generateAudio(explanation.audioScript);
        playRawAudio(
             audioData,
             () => setIsExplanationPlaying(true),
             () => setIsExplanationPlaying(false)
        );
      }
    }
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  return (
    <div className={`mb-12 w-full max-w-4xl bg-white border-4 border-black rounded-3xl shadow-toon p-6 md:p-8 relative overflow-visible transition-all duration-300 ${isActive ? 'ring-8 ring-toon-green/30 transform scale-[1.02]' : ''}`}>
      {/* Number Badge */}
      <div className={`absolute -top-4 -left-4 w-12 h-12 text-white font-black text-2xl flex items-center justify-center rounded-full border-4 border-black shadow-toon-sm z-10 transition-colors ${isActive ? 'bg-toon-green' : 'bg-toon-red'}`}>
        {index + 1}
      </div>

      <div className="pl-2 md:pl-4">
        
        {/* Sentence Groups Display */}
        <div className="flex flex-wrap gap-x-6 gap-y-16 mb-8 items-end leading-loose">
          {chunks.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className="relative flex items-baseline gap-1 group/chunk">
               {/* Bracket decoration */}
               <div className="absolute -bottom-2 left-0 right-0 h-3 border-b-2 border-l-2 border-r-2 border-gray-300 rounded-b-lg opacity-50 group-hover/chunk:border-toon-blue group-hover/chunk:opacity-100 transition-all pointer-events-none"></div>
               
               {chunk.map((seg, i) => {
                 const isCurrentWord = seg.isWord && wordCounter === activeWordIndex;
                 if (seg.isWord) wordCounter++;
                 
                 return (
                  <div key={i} className="relative flex flex-col items-center group/word">
                    {/* Annotation */}
                    {seg.isWord && seg.meaning && (
                      <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 text-xs md:text-sm text-white font-bold whitespace-nowrap bg-toon-blue px-2 py-1 rounded-lg shadow-sm z-20 transform transition-all pointer-events-none">
                        {seg.meaning}
                        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-toon-blue"></span>
                      </span>
                    )}

                    {/* Word */}
                    <span 
                      className={`text-2xl md:text-3xl font-bold tracking-wide z-10 transition-colors duration-200 
                        ${seg.meaning ? 'border-b-2 border-toon-blue/30 border-dashed pb-0.5' : ''}
                        ${isCurrentWord ? 'text-toon-red scale-110' : 'text-gray-800'}
                      `}
                    >
                      {seg.text}
                    </span>

                    {/* IPA */}
                    {seg.isWord && seg.ipa && (
                      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] md:text-xs text-gray-400 font-mono tracking-wide opacity-80 whitespace-nowrap">
                        /{seg.ipa}/
                      </span>
                    )}

                  </div>
                );
               })}
            </div>
          ))}
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button 
            onClick={handlePlayAudio}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-4 border-black font-black text-sm transition-all shadow-toon active:translate-y-1 active:shadow-none
              ${isPlaying ? 'bg-green-100 text-green-700' : 'bg-toon-yellow hover:bg-yellow-300 text-black'}
            `}
          >
            {isPlaying ? '🔊 Stop' : '🔈 Read Aloud'}
          </button>

          <button 
            onClick={handleExplain}
            disabled={loadingExplanation}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-4 border-black font-black text-sm transition-all shadow-toon active:translate-y-1 active:shadow-none
              ${isExplaining ? 'bg-toon-blue text-white ring-4 ring-blue-100' : 'bg-white hover:bg-gray-50 text-black'}
            `}
          >
            {loadingExplanation ? '⌛ Thinking...' : isExplanationPlaying ? '🔊 Teacher Speaking...' : '👨‍🏫 Teacher Explain'}
          </button>
        </div>

        {/* Default Translation & Key Phrases */}
        {!isExplaining && (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-xl border-2 border-dashed border-toon-yellow">
               <p className="text-lg text-gray-700 font-medium">
                🇨🇳 {sentence.translation}
              </p>
            </div>
            
            {sentence.idioms && sentence.idioms.length > 0 && (
              <div className="bg-white p-4 rounded-xl border-l-8 border-toon-green shadow-sm">
                <h4 className="flex items-center gap-2 text-sm font-black text-toon-green uppercase tracking-wider mb-3">
                  <span>🗝️</span> Key Phrases & Collocations
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  {sentence.idioms.map((item, idx) => (
                    <div key={idx} className="flex flex-col bg-green-50 px-4 py-3 rounded-lg border border-green-100">
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 mb-1">
                        <span className="font-bold text-gray-800 text-lg">{item.phrase}</span>
                        <span className="hidden sm:inline text-green-400">→</span>
                        <span className="text-gray-600 font-bold">{item.meaning}</span>
                      </div>
                      {item.example && (
                        <div className="text-sm text-gray-500 flex flex-col gap-1 mt-1">
                           <div className="italic flex gap-2">
                              <span className="not-italic">📝</span> {item.example}
                           </div>
                           {item.exampleMeaning && (
                             <div className="text-gray-400 pl-6 text-xs">
                               {item.exampleMeaning}
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teacher Explanation Mode */}
        {isExplaining && (
          <div className="bg-blue-50 border-4 border-toon-blue rounded-3xl p-6 mt-6 relative animate-fade-in">
             <div className="absolute -top-4 left-6 bg-toon-blue text-white px-4 py-1 text-sm font-black rounded-full border-4 border-white shadow-sm flex items-center gap-2">
               <span>👨‍🏫 Teacher's Notes</span>
               {isExplanationPlaying && <span className="animate-pulse">🔊</span>}
             </div>

             {loadingExplanation ? (
               <div className="flex flex-col items-center justify-center py-10 gap-4 text-toon-blue font-bold opacity-70">
                 <div className="animate-spin h-10 w-10 border-4 border-current border-t-transparent rounded-full"></div>
                 Analyzing structure & preparing audio...
               </div>
             ) : explanation ? (
               <div className="space-y-6 pt-2">
                 <div>
                   <h4 className="text-xs font-black text-toon-blue uppercase tracking-wider mb-2">Sentence Structure (Groups)</h4>
                   <div className="flex flex-wrap gap-2">
                     {explanation.chunks.map((chunk, cIdx) => (
                       <span key={cIdx} className="bg-white border-2 border-toon-blue text-gray-800 px-3 py-1.5 rounded-xl font-bold text-lg shadow-toon-sm">
                         {chunk}
                       </span>
                     ))}
                   </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border-2 border-black shadow-toon-sm">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Meaning</h4>
                      <p className="text-lg text-gray-800 font-bold">{explanation.translation}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border-2 border-black shadow-toon-sm">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Grammar Analysis</h4>
                      <p className="text-gray-700 leading-relaxed font-medium">{explanation.structureAnalysis}</p>
                    </div>
                 </div>

                 {explanation.fixedPhrases && explanation.fixedPhrases.length > 0 && (
                   <div className="bg-green-50 p-5 rounded-2xl border-4 border-toon-green shadow-toon-sm">
                     <h4 className="text-xs font-black text-toon-green uppercase tracking-wider mb-3">Fixed Phrases & Idioms</h4>
                     <ul className="space-y-3">
                       {explanation.fixedPhrases.map((fp, fIdx) => (
                         <li key={fIdx} className="flex flex-col bg-white p-3 rounded-xl border-2 border-green-200">
                           <span className="font-black text-lg text-gray-900 mb-1">{fp.phrase}</span>
                           <span className="text-gray-700 font-medium">{fp.explanation}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}
               </div>
             ) : (
               <div className="text-toon-red font-bold text-center py-4">Failed to load explanation.</div>
             )}
          </div>
        )}

      </div>
    </div>
  );
};

export default SentenceCard;
