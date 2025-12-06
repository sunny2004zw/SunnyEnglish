
import React, { useRef, useState, useEffect } from 'react';
import Button from './Button';

interface ListeningPlayerProps {
  audioUrl: string;
  onTimeUpdate: (currentTime: number) => void;
}

const ListeningPlayer: React.FC<ListeningPlayerProps> = ({ audioUrl, onTimeUpdate }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black p-4 z-50 shadow-[0_-4px_0_rgba(0,0,0,0.1)]">
      <div className="max-w-4xl mx-auto flex items-center gap-4 md:gap-8">
        {/* Play/Pause Button */}
        <Button 
          onClick={togglePlay}
          variant={isPlaying ? 'accent' : 'primary'}
          className="w-14 h-14 !px-0 rounded-full flex items-center justify-center text-2xl shadow-toon-sm"
        >
          {isPlaying ? '⏸' : '▶'}
        </Button>

        {/* Progress Bar & Info */}
        <div className="flex-1 flex flex-col justify-center">
           <div className="flex justify-between text-xs font-black text-gray-500 mb-1 uppercase tracking-wide">
             <span>{formatTime(currentTime)}</span>
             <span>Original Audio</span>
             <span>{formatTime(duration)}</span>
           </div>
           
           <div className="relative h-4 bg-gray-200 rounded-full border-2 border-black overflow-hidden">
             <div 
               className="absolute top-0 left-0 h-full bg-toon-green transition-all duration-100 ease-linear"
               style={{ width: `${(currentTime / duration) * 100}%` }}
             />
             <input 
               type="range" 
               min="0" 
               max={duration || 100} 
               value={currentTime} 
               onChange={handleSeek}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
           </div>
        </div>

        {/* Hidden Audio Element */}
        <audio ref={audioRef} src={audioUrl} className="hidden" />
      </div>
    </div>
  );
};

export default ListeningPlayer;
