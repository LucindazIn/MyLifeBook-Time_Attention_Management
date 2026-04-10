import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { AppLanguage, CustomTag } from '@/types';
import { cn } from '@/lib/utils';
import { DayTagSelector } from './DayTagSelector';

interface DayHeaderProps {
  date: Date;
  dayName?: string;
  onRandomDayName?: () => void;
  onNameChange?: (newName: string) => void;
  language?: AppLanguage;
  currentTag?: string;
  onSelectTag?: (tag: string) => void;
  customTags?: CustomTag[];
  onAddCustomTag?: (tag: CustomTag) => void;
  onRemoveCustomTag?: (id: string) => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({ 
  date, 
  dayName, 
  onRandomDayName, 
  onNameChange, 
  language = 'en',
  currentTag,
  onSelectTag,
  customTags,
  onAddCustomTag,
  onRemoveCustomTag
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(dayName || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(dayName || '');
  }, [dayName]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    setIsEditing(false);
    if (inputValue.trim() !== dayName) {
      onNameChange?.(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const formattedDate = language === 'zh' 
    ? format(date, 'yyyy年M月d日 EEEE', { locale: zhCN })
    : format(date, 'EEEE, MMMM do');

  const placeholder = language === 'zh' ? '为这一天命名...' : 'Name this day...';
  const defaultName = language === 'zh' ? '美好的一天' : 'Your Day';
  const displayName = dayName || defaultName;
  /**
   * `ch` is the width of "0" in the font — CJK glyphs are wider, so a straight char-count in `ch`
   * makes the box too narrow and glyphs stack (looks like "ghost" / overlap).
   */
  const titleLen = Math.max(inputValue.length, displayName.length);
  const titleWidthCh = Math.min(
    Math.max(Math.ceil(titleLen * (language === 'zh' ? 1.65 : 1.05)), 4),
    48
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 text-center w-full px-1 group"
    >
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-1">
        {formattedDate}
      </div>
      
      <div className="flex w-full justify-center items-center min-h-[3.25rem] px-2">
        <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {onSelectTag && (
            <div
              className={cn(
                'flex shrink-0 items-center',
                isEditing && 'invisible pointer-events-none',
                currentTag
                  ? 'opacity-100'
                  : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-300'
              )}
              aria-hidden={isEditing}
            >
              <DayTagSelector 
                currentTag={currentTag} 
                onSelectTag={onSelectTag} 
                language={language} 
                customTags={customTags}
                onAddCustomTag={onAddCustomTag}
                onRemoveCustomTag={onRemoveCustomTag}
              />
            </div>
          )}

          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label={language === 'zh' ? '编辑今日名称' : 'Edit day name'}
              className={cn(
                'text-3xl md:text-4xl font-serif font-bold text-foreground text-center',
                'border-0 bg-background px-0.5 py-0 h-auto min-h-0 box-border min-w-0 max-w-[min(90vw,28rem)] shrink-0',
                'shadow-none outline-none ring-0 ring-offset-0',
                'focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
                'placeholder:text-muted-foreground'
              )}
              style={{
                width: `${titleWidthCh}ch`,
              }}
            />
          ) : (
            <h1 
              className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight hover:text-accent transition-colors cursor-pointer whitespace-nowrap text-center max-w-[min(90vw,28rem)] px-0.5 shrink-0"
              onClick={() => setIsEditing(true)}
            >
              {displayName}
            </h1>
          )}

          {onRandomDayName && (
            <div
              className={cn(
                'flex shrink-0 items-center',
                isEditing && 'invisible pointer-events-none',
                !isEditing &&
                  'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity sm:duration-300'
              )}
              aria-hidden={isEditing}
            >
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRandomDayName();
                }}
                className="inline-flex w-8 h-8 items-center justify-center rounded-full hover:bg-accent/20 active:bg-accent/30 text-accent hover:opacity-90"
                title={language === 'zh' ? '从名称库随机换一个' : 'Pick A Random Name From The Pool'}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
