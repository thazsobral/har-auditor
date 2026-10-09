import React, { useState, useRef, useEffect } from 'react';
import { useTheme, type Theme } from '../../store/useTheme.ts';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

interface ThemeSelectorProps {
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ compact = false }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themes: Array<{ id: Theme; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'dark', label: 'Escuro', icon: Moon },
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'system', label: 'Sistema', icon: Laptop },
  ];

  const currentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;
  const CurrentIconComponent = currentIcon;

  if (compact) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition border border-zinc-300 dark:border-zinc-800 flex items-center justify-center bg-white dark:bg-zinc-900"
          title={`Tema: ${theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Sistema'}`}
        >
          <CurrentIconComponent size={15} />
        </button>

        {isOpen && (
          <div className="absolute right-0 bottom-full sm:bottom-auto sm:top-full mt-1 sm:mt-1.5 mb-1.5 sm:mb-0 w-36 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 py-1 z-50 text-xs font-sans">
            <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold border-b border-zinc-100 dark:border-zinc-800">
              Tema da Interface
            </div>
            {themes.map((item) => {
              const Icon = item.icon;
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTheme(item.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 transition text-left ${
                    isSelected
                      ? 'text-cyan-600 dark:text-cyan-400 font-medium bg-zinc-100 dark:bg-zinc-800/60'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={isSelected ? 'text-cyan-500' : 'text-zinc-400'} />
                    <span>{item.label}</span>
                  </div>
                  {isSelected && <Check size={12} className="text-cyan-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Segmented control style (expanded)
  return (
    <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-300 dark:border-zinc-800 text-xs">
      {themes.map((item) => {
        const Icon = item.icon;
        const isSelected = theme === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setTheme(item.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition ${
              isSelected
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title={`Alternar para tema ${item.label}`}
          >
            <Icon size={13} className={isSelected ? 'text-cyan-500 dark:text-cyan-400' : ''} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
