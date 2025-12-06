
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisResult, AnalyzedSentence, WordSegment } from '../types';
import { generateDocumentAudio } from '../services/geminiService';
import { decode, decodePCM } from '../services/audioUtils';
import Button from './Button';

interface ImmersiveReaderProps {
  data: AnalysisResult;
  accent: 'US' | 'UK';
  onClose: () => void;
}

type PlaybackMode = 'CONTINUOUS' | 'INTERVAL' | 'MANUAL';

const ImmersiveReader: React.FC<ImmersiveReaderProps> = ({ data, accent, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<PlaybackMode>('CONTINUOUS');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false); // For interval wait state
  const [waitProgress, setWaitProgress] = useState(0); // 0 to 100 for progress bar
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  // Refs for audio and timing
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null); // For countdown update
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Scroll ref
  const currentSentenceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Audio Context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      stopPlayback();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Scroll current sentence into view
  useEffect(() => {
    if (currentSentenceRef.current && containerRef.current) {
      currentSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  const stopPlayback = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setIsWaiting(false);
    setWaitProgress(0);
    setCurrentWordIndex(-1);
    setLoadingAudio(false);
  };

  const playSentence = async (index: number) => {
    stopPlayback();
    setCurrentIndex(index);
    setLoadingAudio(true);
    setIsPlaying(true);

    try {
      const sentence = data.sentences[index];
      const text = sentence.originalText || sentence.segments.map(s => s.text).join('');
      
      // 1. Fetch Audio
      const base64Audio = await generateDocumentAudio(text, accent);
      
      // 2. Decode
      if (!audioContextRef.current) return;
      const pcmBytes = decode(base64Audio);
      const audioBuffer = decodePCM(pcmBytes, audioContextRef.current, 24000, 1);
      durationRef.current = audioBuffer.duration;

      // 3. Play
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      sourceRef.current = source;

      source.onended = () => {
        handleSentenceEnd(index, audioBuffer.duration);
      };

      startTimeRef.current = audioContextRef.current.currentTime;
      source.start(0);
      setLoadingAudio(false);

      // 4. Start Word Highlighter Animation
      startHighlighting(sentence, audioBuffer.duration);

    } catch (error) {
      console.error("Playback error", error);
      setLoadingAudio(false);
      setIsPlaying(false);
    }
  };

  const startHighlighting = (sentence: AnalyzedSentence, duration: number) => {
    // Estimate word timings based on character count relative to total length
    const words = sentence.segments.filter(s => s.isWord);
    const totalChars = words.reduce((sum, s) => sum + s.text.length, 0);
    
    // Pre-calculate timing ratios
    let accumulatedChars = 0;
    const timings = words.map(w => {
      const startRatio = accumulatedChars / totalChars;
      accumulatedChars += w.text.length;
      const endRatio = accumulatedChars / totalChars;
      return { start: startRatio * duration, end: endRatio * duration };
    });

    const animate = () => {
      if (!audioContextRef.current) return;
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
      
      if (elapsed >= duration) {
        setCurrentWordIndex(-1);
        return;
      }

      // Find active word
      const wordIdx = timings.findIndex(t => elapsed >= t.start && elapsed < t.end);
      if (wordIdx !== -1) {
        setCurrentWordIndex(wordIdx); 
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleSentenceEnd = (finishedIndex: number, duration: number) => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setCurrentWordIndex(-1);

    // MANUAL MODE: Stop immediately
    if (mode === 'MANUAL') {
      setIsPlaying(false);
      return;
    }

    // CONTINUOUS MODE
    if (mode === 'CONTINUOUS') {
      const nextIndex = finishedIndex + 1;
      if (nextIndex < data.sentences.length) {
        timeoutRef.current = window.setTimeout(() => {
           playSentence(nextIndex);
        }, 500); 
      } else {
        setIsPlaying(false); // End of doc
      }
      return;
    }

    // INTERVAL MODE: Wait (Duration + 5s)
    if (mode === 'INTERVAL') {
      setIsWaiting(true);
      
      // Calculate Wait Time: Audio Duration + 5 seconds
      // Usually users want to shadow (repeat), so we give them the time it took to read it + 5s buffer.
      const waitTimeMs = (duration * 1000) + 5000;
      const startTime = Date.now();
      
      // Start Countdown for UI
      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / waitTimeMs) * 100, 100);
        setWaitProgress(progress);
      }, 50);

      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setWaitProgress(0);
        setIsWaiting(false);
        const nextIndex = finishedIndex + 1;
        if (nextIndex < data.sentences.length) {
          playSentence(nextIndex);
        } else {
          setIsPlaying(false);
        }
      }, waitTimeMs);
    }
  };

  // -- Controls --

  const togglePlay = () => {
    if (isPlaying || isWaiting) {
      stopPlayback();
    } else {
      playSentence(currentIndex);
    }
  };

  const skipToNext = () => {
    const next = Math.min(currentIndex + 1, data.sentences.length - 1);
    playSentence(next);
  };

  const skipToPrev = () => {
    const prev = Math.max(currentIndex - 1, 0);
    playSentence(prev);
  };

  const repeatCurrent = () => {
    playSentence(currentIndex);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="bg-toon-yellow p-4 flex justify-between items-center shadow-toon z-10 border-b-4 border-black">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎧</span>
          <h2 className="text-xl md:text-2xl font-black text-black">
            Immersive Reader ({accent})
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="bg-red-500 text-white w-10 h-10 rounded-xl border-4 border-black font-black flex items-center justify-center hover:bg-red-600 shadow-toon-sm active:translate-y-1 active:shadow-none"
        >
          ✕
        </button>
      </div>

      {/* Main Text Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50 relative">
        <div className="max-w-4xl mx-auto space-y-8">
          {data.sentences.map((sentence, sIdx) => {
            const isActiveSentence = sIdx === currentIndex;
            let wordCounter = 0;

            return (
              <div 
                key={sIdx}
                ref={isActiveSentence ? currentSentenceRef : null}
                onClick={() => !isPlaying && !isWaiting && setCurrentIndex(sIdx)}
                className={`
                  p-6 rounded-3xl border-4 transition-all duration-300 cursor-pointer
                  ${isActiveSentence 
                    ? 'bg-white border-toon-blue shadow-toon scale-[1.02]' 
                    : 'bg-transparent border-transparent hover:bg-gray-100 opacity-60 hover:opacity-100'}
                `}
              >
                <div className="text-2xl md:text-4xl font-bold leading-relaxed tracking-wide text-gray-800 flex flex-wrap gap-x-3 gap-y-2">
                  {sentence.segments.map((seg, segIdx) => {
                     let isHighlighted = false;
                     if (seg.isWord) {
                       if (isActiveSentence && isPlaying && !isWaiting && wordCounter === currentWordIndex) {
                         isHighlighted = true;
                       }
                       wordCounter++;
                     }

                     return (
                       <span 
                         key={segIdx}
                         className={`transition-colors duration-100 ${isHighlighted ? 'text-toon-red scale-110' : ''}`}
                       >
                         {seg.text}
                       </span>
                     );
                  })}
                </div>
                
                {isActiveSentence && isWaiting && (
                  <div className="mt-4 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-toon-green transition-all duration-75 ease-linear"
                      style={{ width: `${waitProgress}%` }}
                    />
                  </div>
                )}
                
                {/* Translation hint */}
                <div className={`mt-4 text-lg font-medium text-gray-600 transition-opacity duration-500 ${isActiveSentence ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                  {sentence.translation}
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-40"></div> {/* Bottom Spacer */}
      </div>

      {/* Bottom Controls */}
      <div className="bg-white border-t-4 border-black p-4 shadow-[0_-4px_0_rgba(0,0,0,0.1)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          
          {/* Mode Selector */}
          <div className="flex justify-center gap-2">
            {[
              { id: 'CONTINUOUS', label: '🔄 Continuous', desc: 'Read all non-stop' },
              { id: 'INTERVAL', label: '⏱️ Interval', desc: 'Read sentence, wait (duration+5s), read next' },
              { id: 'MANUAL', label: '👆 Manual', desc: 'Read one sentence then stop. You choose what to do.' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  stopPlayback();
                  setMode(m.id as PlaybackMode);
                }}
                className={`
                  flex-1 md:flex-none px-4 py-2 rounded-xl font-bold border-2 border-black text-sm md:text-base transition-all
                  ${mode === m.id ? 'bg-toon-blue text-white shadow-toon-sm transform -translate-y-1' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                `}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4 md:gap-8">
            
            <Button 
              variant="secondary" 
              onClick={skipToPrev} 
              disabled={loadingAudio} 
              className={`w-12 h-12 !px-0 flex items-center justify-center rounded-full transition-all ${mode === 'MANUAL' && !isPlaying ? 'ring-4 ring-yellow-200' : ''}`}
            >
              ⏮
            </Button>

            <Button 
              variant={isPlaying || isWaiting ? 'danger' : 'primary'} 
              onClick={togglePlay}
              disabled={loadingAudio && !isPlaying}
              className="w-20 h-20 !px-0 flex items-center justify-center rounded-full text-3xl transition-transform active:scale-95"
            >
              {loadingAudio ? (
                <div className="animate-spin h-8 w-8 border-4 border-current border-t-transparent rounded-full" />
              ) : (
                isPlaying || isWaiting ? '⏸' : '▶'
              )}
            </Button>

            <Button 
              variant="secondary" 
              onClick={skipToNext} 
              disabled={loadingAudio} 
              className={`w-12 h-12 !px-0 flex items-center justify-center rounded-full transition-all ${mode === 'MANUAL' && !isPlaying ? 'ring-4 ring-yellow-200' : ''}`}
            >
              ⏭
            </Button>

            {/* Manual-Specific Controls - Always visible in Manual mode when stopped */}
            {mode === 'MANUAL' && !isPlaying && (
              <Button 
                 variant="accent" 
                 onClick={repeatCurrent} 
                 disabled={loadingAudio}
                 className="flex items-center gap-2 animate-bounce-short"
              >
                🔁 Repeat
              </Button>
            )}

          </div>

          {/* Status Text */}
          <div className="text-center h-6 font-bold text-gray-500 text-sm">
            {loadingAudio ? 'Downloading Audio...' : 
             isWaiting ? `Shadowing Pause... ${(durationRef.current + 5 - (waitProgress/100 * (durationRef.current + 5))).toFixed(1)}s` :
             isPlaying ? `Reading Sentence ${currentIndex + 1} of ${data.sentences.length}` : 
             mode === 'MANUAL' ? 'Paused. Choose Next, Previous, or Repeat.' :
             'Ready to Read'}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ImmersiveReader;
