
import React from 'react';
import { QuestionAnalysis } from '../types';

interface QuestionAnalysisProps {
  questions: QuestionAnalysis[];
}

const QuestionAnalysisSection: React.FC<QuestionAnalysisProps> = ({ questions }) => {
  return (
    <div className="w-full max-w-4xl mt-12 mb-20 animate-fade-in">
       <div className="flex items-center gap-4 mb-6">
         <div className="bg-toon-red text-white p-3 rounded-xl border-4 border-black shadow-toon-sm rotate-3">
           <span className="text-3xl font-black">?</span>
         </div>
         <h2 className="text-3xl font-black text-gray-800 text-stroke-white drop-shadow-md">
           Listening Quiz Analysis
         </h2>
       </div>

       <div className="space-y-8">
         {questions.map((q, idx) => (
           <div key={idx} className="bg-white border-4 border-black rounded-3xl shadow-toon p-6 md:p-8 relative">
             <div className="absolute -top-4 -left-2 bg-black text-white px-3 py-1 font-bold rounded-lg rotate-[-2deg]">
               Question {idx + 1}
             </div>

             {/* Question & Options */}
             <div className="mb-6">
               <h3 className="text-xl font-bold text-gray-800 mb-4">{q.questionText}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {q.options.map((opt, oIdx) => {
                   const isCorrect = opt.startsWith(q.correctOption) || opt.includes(`(${q.correctOption})`);
                   return (
                     <div 
                       key={oIdx} 
                       className={`
                         p-3 rounded-xl border-2 font-medium transition-colors
                         ${isCorrect 
                           ? 'bg-green-100 border-green-500 text-green-900' 
                           : 'bg-gray-50 border-gray-200 text-gray-600'}
                       `}
                     >
                       {opt} {isCorrect && '✅'}
                     </div>
                   );
                 })}
               </div>
             </div>

             {/* Teacher's Explanation */}
             <div className="bg-red-50 border-2 border-dashed border-toon-red rounded-2xl p-4 md:p-6 relative">
               <span className="absolute -top-3 left-6 bg-white text-toon-red px-2 font-black border border-toon-red rounded text-sm">
                 👩‍🏫 Teacher's Correction
               </span>
               <p className="text-gray-800 font-medium leading-relaxed">
                 {q.explanation}
               </p>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
};

export default QuestionAnalysisSection;
