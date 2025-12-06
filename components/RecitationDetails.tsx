
import React, { useState, useEffect } from 'react';
import Button from './Button';
import { Idiom, VocabularyItem } from '../types';
import { generateVocabularyList } from '../services/geminiService';

interface RecitationDetailsProps {
  type: 'WORDS' | 'PHRASES';
  newItems: any[];
  reviewItems: any[];
  onClose: () => void;
  onDownload: (items: any[], title: string) => void;
  isDownloading: boolean;
}

const RecitationDetails: React.FC<RecitationDetailsProps> = ({ 
  type, 
  newItems, 
  reviewItems, 
  onClose, 
  onDownload,
  isDownloading 
}) => {
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailedNewWords, setDetailedNewWords] = useState<VocabularyItem[]>([]);
  const [detailedReviewWords, setDetailedReviewWords] = useState<VocabularyItem[]>([]);

  useEffect(() => {
    if (type === 'WORDS') {
      const fetchDetails = async () => {
        setLoadingDetails(true);
        try {
          if (newItems.length > 0) {
            const res = await generateVocabularyList(newItems as string[]);
            setDetailedNewWords(res);
          }
          if (reviewItems.length > 0) {
            const res = await generateVocabularyList(reviewItems as string[]);
            setDetailedReviewWords(res);
          }
        } catch (e) {
          console.error("Failed to fetch vocabulary details", e);
        } finally {
          setLoadingDetails(false);
        }
      };
      fetchDetails();
    }
  }, [type, newItems, reviewItems]);
  
  const handleDownloadAll = () => {
    const combined = [...newItems, ...reviewItems];
    const dateStr = new Date().toLocaleDateString();
    onDownload(combined, `${dateStr} - All Recitation ${type === 'WORDS' ? 'Words' : 'Phrases'}`);
  };

  const renderDetailedWordCard = (item: VocabularyItem, idx: number) => (
    <div key={idx} className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm flex flex-col gap-2">
      <div className="flex justify-between items-baseline border-b pb-2 border-gray-100">
        <div className="flex items-baseline gap-2">
          <span className="font-black text-xl text-gray-800">{item.word}</span>
          <span className="font-mono text-sm text-gray-500">/{item.ipa}/</span>
        </div>
        <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded uppercase">{item.pos}</span>
      </div>
      
      <div className="flex flex-col gap-1">
        <span className="font-bold text-gray-700">{item.meaning}</span>
        {item.verbForms && (
          <div className="text-xs text-gray-500 flex gap-4 mt-1 bg-gray-50 p-1.5 rounded">
            {item.verbForms.past && <span>Past: <b>{item.verbForms.past}</b></span>}
            {item.verbForms.pastParticiple && <span>PP: <b>{item.verbForms.pastParticiple}</b></span>}
          </div>
        )}
      </div>

      {item.collocations && item.collocations.length > 0 && (
        <div className="bg-gray-50 p-2 rounded-lg mt-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Collocations</div>
          <div className="text-sm text-gray-600 space-y-1">
             {item.collocations.map((c, i) => (
               <div key={i} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                 <span className="font-medium text-gray-800">{c.phrase}</span>
                 <span className="text-gray-500 text-xs sm:text-sm">{c.meaning}</span>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPhraseCard = (phrase: Idiom, idx: number) => (
    <div key={idx} className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm flex flex-col gap-2">
      <div className="flex flex-col border-b pb-2 border-gray-100">
        <span className="font-black text-xl text-toon-blue">{phrase.phrase}</span>
        <span className="font-bold text-gray-700">{phrase.meaning}</span>
      </div>
      
      {phrase.example && (
         <div className="bg-gray-50 p-2 rounded-lg italic text-sm">
           <div className="text-gray-800 mb-0.5">"{phrase.example}"</div>
           <div className="text-gray-500 not-italic text-xs">{phrase.exampleMeaning}</div>
         </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Header */}
      <div className={`p-4 flex justify-between items-center shadow-toon border-b-4 border-black ${type === 'WORDS' ? 'bg-yellow-100' : 'bg-green-100'}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{type === 'WORDS' ? '📖' : '🗝️'}</span>
          <h2 className="text-2xl font-black text-gray-800">
            Today's {type === 'WORDS' ? 'Words' : 'Phrases'}
          </h2>
        </div>
        <div className="flex gap-3">
           <Button 
            variant="accent" 
            onClick={handleDownloadAll}
            disabled={isDownloading || (newItems.length === 0 && reviewItems.length === 0)}
          >
            {isDownloading || loadingDetails ? 'Preparing...' : '📥 Download All PDF'}
          </Button>
          <button 
            onClick={onClose}
            className="bg-red-500 text-white w-12 h-12 rounded-xl border-4 border-black font-black flex items-center justify-center hover:bg-red-600 shadow-toon-sm active:translate-y-1 active:shadow-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
          
          {/* New Section */}
          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-2xl border-4 border-black shadow-toon ${type === 'WORDS' ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <h3 className="text-xl font-black text-gray-800 mb-4 border-b-2 border-gray-200 pb-2 flex justify-between">
                <span>New Today</span>
                <span className="bg-white px-2 rounded border border-black text-sm">{newItems.length}</span>
              </h3>
              
              {loadingDetails ? (
                <div className="text-center py-8 flex flex-col items-center text-gray-500">
                  <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-2"></div>
                  Fetching details...
                </div>
              ) : newItems.length === 0 ? (
                <div className="text-gray-400 italic text-center py-4">No new items today.</div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {type === 'WORDS' 
                    ? detailedNewWords.map((item, i) => renderDetailedWordCard(item, i))
                    : newItems.map((item, i) => renderPhraseCard(item as Idiom, i))
                  }
                </div>
              )}
            </div>
          </div>

          {/* Review Section */}
          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-2xl border-4 border-black shadow-toon ${type === 'WORDS' ? 'bg-blue-50' : 'bg-red-50'}`}>
              <h3 className="text-xl font-black text-gray-800 mb-4 border-b-2 border-gray-200 pb-2 flex justify-between">
                <span>Review Today</span>
                <span className="bg-white px-2 rounded border border-black text-sm">{reviewItems.length}</span>
              </h3>

              {loadingDetails ? (
                <div className="text-center py-8 flex flex-col items-center text-gray-500">
                   <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin mb-2"></div>
                   Fetching details...
                </div>
              ) : reviewItems.length === 0 ? (
                <div className="text-gray-400 italic text-center py-4">No reviews scheduled for today.</div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {type === 'WORDS' 
                    ? detailedReviewWords.map((item, i) => renderDetailedWordCard(item, i))
                    : reviewItems.map((item, i) => renderPhraseCard(item as Idiom, i))
                  }
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RecitationDetails;
