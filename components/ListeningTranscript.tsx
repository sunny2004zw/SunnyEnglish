
import React, { useMemo } from 'react';
import { AnalyzedSentence } from '../types';

interface ListeningTranscriptProps {
  sentences: AnalyzedSentence[];
  currentTime: number;
  onSeek: (time: number) => void;
}

const ListeningTranscript: React.FC<ListeningTranscriptProps> = ({ sentences, currentTime, onSeek }) => {
  return (
    <div className="w-full max-w-4xl bg-white border-4 border-black rounded-3xl shadow-toon p-6 md:p-10 mb-12 animate-fade-in">
      <div className="flex items-center gap-4 mb-6 border-b-4 border-gray-100 pb-4">
        <div className="bg-toon-blue text-white p-3 rounded-xl border-4 border-black shadow-toon-sm -rotate-2">
          <span className="text-2xl font-black">📜</span>
        </div>
        <h2 className="text-3xl font-black text-gray-800">
          Listening Transcript
        </h2>
      </div>

      <div className="prose prose-xl max-w-none leading-relaxed text-gray-600 font-medium">
        {sentences.map((sentence, sIdx) => {
          // Check if this sentence is active
          const isActive = 
            sentence.startTime !== undefined && 
            sentence.endTime !== undefined &&
            currentTime >= sentence.startTime && 
            currentTime < sentence.endTime;

          // Calculate progress for karaoke effect
          let progress = 0;
          if (isActive && sentence.startTime !== undefined && sentence.endTime !== undefined) {
            const duration = sentence.endTime - sentence.startTime;
            if (duration > 0) {
              progress = Math.min(Math.max((currentTime - sentence.startTime) / duration, 0), 1);
            }
          }

          // Render words
          const words = sentence.segments;
          const totalLength = words.reduce((acc, seg) => acc + (seg.isWord ? seg.text.length : 0), 0);
          
          let charCounter = 0;
          const highlightThreshold = progress * totalLength;

          return (
            <span 
              key={sIdx} 
              className={`inline cursor-pointer hover:bg-yellow-100 rounded px-1 transition-colors duration-200 ${isActive ? 'bg-blue-50' : ''}`}
              onClick={() => sentence.startTime !== undefined && onSeek(sentence.startTime)}
            >
              {words.map((seg, wIdx) => {
                let isHighlighted = false;
                if (isActive && seg.isWord) {
                  // Simple linear interpolation for word highlighting
                  const wordStartChar = charCounter;
                  // If the estimated progress is past the start of this word
                  if (highlightThreshold > wordStartChar) {
                    isHighlighted = true;
                  }
                  charCounter += seg.text.length;
                }

                // Spacing Logic: 
                // Add space if:
                // 1. Current is a word AND next is NOT a 'no-space-before' punctuation (like . , ! ?)
                // 2. Current is a 'space-after' punctuation (like , . ! ?)
                const nextSeg = words[wIdx + 1];
                const isNextNoSpacePunc = nextSeg ? /^[.,!?;:'’”]/.test(nextSeg.text) : false;
                const isCurrentSpaceAfterPunc = !seg.isWord && /^[.,!?;:]/.test(seg.text);

                const shouldAddSpace = (seg.isWord && !isNextNoSpacePunc) || isCurrentSpaceAfterPunc;

                return (
                  <React.Fragment key={wIdx}>
                    <span 
                      className={`transition-colors duration-100 ${isHighlighted ? 'text-toon-blue font-bold' : isActive ? 'text-gray-800' : ''}`}
                    >
                      {seg.text}
                    </span>
                    {shouldAddSpace && wIdx < words.length - 1 && <span> </span>}
                  </React.Fragment>
                );
              })}
              {/* Add a space after the sentence for natural reading flow */}
              <span> </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default ListeningTranscript;
