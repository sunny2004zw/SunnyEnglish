
import React, { useState, useEffect } from 'react';
import Button from './Button';
import RecitationDetails from './RecitationDetails';
import { getWordsForToday, getPhrasesForToday } from '../services/srsService';
import { Idiom } from '../types';

interface RecitationModuleProps {
  onDownloadWords: (words: string[], title: string) => void;
  onDownloadPhrases: (phrases: Idiom[], title: string) => void;
  isGeneratingWords: boolean;
}

const RecitationModule: React.FC<RecitationModuleProps> = ({ onDownloadWords, onDownloadPhrases, isGeneratingWords }) => {
  const [wordCounts, setWordCounts] = useState({ newToday: 0, reviewToday: 0 });
  const [phraseCounts, setPhraseCounts] = useState({ newToday: 0, reviewToday: 0 });
  
  // Data holders
  const [wordsData, setWordsData] = useState<{newToday: string[], reviewToday: string[]}>({ newToday: [], reviewToday: [] });
  const [phrasesData, setPhrasesData] = useState<{newToday: Idiom[], reviewToday: Idiom[]}>({ newToday: [], reviewToday: [] });

  // View State
  const [viewDetails, setViewDetails] = useState<'WORDS' | 'PHRASES' | null>(null);

  useEffect(() => {
    const w = getWordsForToday();
    const p = getPhrasesForToday();
    setWordsData(w);
    setPhrasesData(p);
    setWordCounts({ newToday: w.newToday.length, reviewToday: w.reviewToday.length });
    setPhraseCounts({ newToday: p.newToday.length, reviewToday: p.reviewToday.length });
  }, []);

  return (
    <div className="w-full max-w-4xl mt-10 animate-fade-in-up">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-purple-500 text-white p-3 rounded-xl border-4 border-black shadow-toon-sm -rotate-2">
          <span className="text-3xl font-black">🧠</span>
        </div>
        <h2 className="text-3xl font-black text-gray-800 text-stroke-white drop-shadow-md">
          Daily Recitation (Ebbinghaus)
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* WORDS CARD */}
        <div className="bg-white border-4 border-black rounded-3xl shadow-toon p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-100 rounded-full -mr-10 -mt-10 opacity-50 z-0"></div>
          
          <div className="flex justify-between items-center mb-4 z-10 relative">
             <h3 className="text-2xl font-black text-gray-800">Words 📖</h3>
             <button 
               onClick={() => setViewDetails('WORDS')}
               className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg border-2 border-black font-bold text-sm shadow-sm active:translate-y-0.5 active:shadow-none transition-all"
             >
               👁️ View List
             </button>
          </div>
          
          <div className="space-y-4 relative z-10">
            {/* New Today */}
            <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-yellow-600 uppercase">New Today</div>
                <div className="text-3xl font-black text-gray-800">{wordCounts.newToday}</div>
              </div>
              <Button 
                variant="primary" 
                className="!px-3 !py-1 text-sm h-10" 
                onClick={() => onDownloadWords(wordsData.newToday, "New Words Today")}
                disabled={wordCounts.newToday === 0 || isGeneratingWords}
              >
                Download PDF
              </Button>
            </div>

            {/* Review Today */}
            <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase">Review Today</div>
                <div className="text-3xl font-black text-gray-800">{wordCounts.reviewToday}</div>
              </div>
               <Button 
                variant="accent" 
                className="!px-3 !py-1 text-sm h-10" 
                onClick={() => onDownloadWords(wordsData.reviewToday, "Review Words Today")}
                disabled={wordCounts.reviewToday === 0 || isGeneratingWords}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </div>

        {/* PHRASES CARD */}
        <div className="bg-white border-4 border-black rounded-3xl shadow-toon p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-100 rounded-full -mr-10 -mt-10 opacity-50 z-0"></div>
          
          <div className="flex justify-between items-center mb-4 z-10 relative">
             <h3 className="text-2xl font-black text-gray-800">Phrases 🗝️</h3>
             <button 
               onClick={() => setViewDetails('PHRASES')}
               className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg border-2 border-black font-bold text-sm shadow-sm active:translate-y-0.5 active:shadow-none transition-all"
             >
               👁️ View List
             </button>
          </div>
          
          <div className="space-y-4 relative z-10">
            {/* New Today */}
            <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-green-600 uppercase">New Today</div>
                <div className="text-3xl font-black text-gray-800">{phraseCounts.newToday}</div>
              </div>
              <Button 
                variant="primary" 
                className="!px-3 !py-1 text-sm h-10" 
                onClick={() => onDownloadPhrases(phrasesData.newToday, "New Phrases Today")}
                disabled={phraseCounts.newToday === 0}
              >
                Download PDF
              </Button>
            </div>

            {/* Review Today */}
            <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-red-600 uppercase">Review Today</div>
                <div className="text-3xl font-black text-gray-800">{phraseCounts.reviewToday}</div>
              </div>
              <Button 
                variant="danger" 
                className="!px-3 !py-1 text-sm h-10" 
                onClick={() => onDownloadPhrases(phrasesData.reviewToday, "Review Phrases Today")}
                disabled={phraseCounts.reviewToday === 0}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* DETAILED VIEW OVERLAY */}
      {viewDetails && (
        <RecitationDetails 
          type={viewDetails}
          newItems={viewDetails === 'WORDS' ? wordsData.newToday : phrasesData.newToday}
          reviewItems={viewDetails === 'WORDS' ? wordsData.reviewToday : phrasesData.reviewToday}
          onClose={() => setViewDetails(null)}
          onDownload={viewDetails === 'WORDS' ? onDownloadWords : onDownloadPhrases}
          isDownloading={isGeneratingWords}
        />
      )}

    </div>
  );
};

export default RecitationModule;
