import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading,
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-3 font-bold transition-all duration-200 border-4 border-black rounded-xl shadow-toon active:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-toon-yellow text-black hover:bg-yellow-300",
    secondary: "bg-toon-white text-black hover:bg-gray-100",
    accent: "bg-toon-blue text-white hover:bg-blue-400",
    danger: "bg-toon-red text-white hover:bg-red-400",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Thinking...
        </span>
      ) : children}
    </button>
  );
};

export default Button;