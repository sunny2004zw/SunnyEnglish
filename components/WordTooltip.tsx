
import React, { useState, useEffect } from 'react';
import { lookupWord } from '../services/geminiService';

interface WordTooltipProps {
  text: string;
  className?: string;
  contextMeaning?: string | null; // Meaning from the main analysis (optional)
}

const WordTooltip: React.FC<WordTooltipProps> = ({ text, className, contextMeaning }) => {
  const [show, setShow] = useState(false);
  const [data, setData] = useState<{ ipa: string; meaning: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    // Only fetch if showing, no data yet, and not loading
    if (show && !data && !loading) {
      setLoading(true);
      lookupWord(text).then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      });
    }
    return () => { isMounted = false; };
  }, [show, text, data, loading]);

  // Priority: Context Meaning > Fetched Meaning for definitions
  // But usually contextMeaning is brief. The user wants IPA + Meaning on hover.
  const displayMeaning = contextMeaning || data?.meaning;
  const displayIPA = data?.ipa;

  return (
    <div 
      className="relative inline-block group/tooltip"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`cursor-help ${className}`}>
        {text}
      </span>

      {/* Floating Tooltip */}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none w-max max-w-[200px]">
           <div className="bg-black/90 backdrop-blur-sm text-white text-sm rounded-xl px-3 py-2 shadow-2xl flex flex-col items-center animate-fade-in border-2 border-white/20">
              {loading && !data ? (
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <div className="w-2 h-2 bg-toon-yellow rounded-full animate-ping"></div>
                  Loading...
                </div>
              ) : (
                <>
                  {displayIPA && (
                    <span className="font-mono text-toon-yellow text-xs mb-1 tracking-wide border-b border-white/20 pb-0.5">
                      /{displayIPA}/
                    </span>
                  )}
                  <span className="font-bold text-center leading-tight">
                    {displayMeaning || '...'}
                  </span>
                </>
              )}
              {/* Triangle Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90"></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WordTooltip;
