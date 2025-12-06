import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-8 flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-5xl md:text-7xl font-black text-toon-yellow text-stroke-black drop-shadow-toon mb-4 transform -rotate-2">
        Toon Reader
      </h1>
      <p className="text-xl md:text-2xl font-bold text-gray-700 bg-white px-6 py-2 rounded-full border-4 border-black shadow-toon-sm rotate-1">
        📚 Make English Fun Again! 🚀
      </p>
      <style>{`
        .text-stroke-black {
          -webkit-text-stroke: 3px black;
        }
      `}</style>
    </header>
  );
};

export default Header;