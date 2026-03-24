import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AppLanguage, CustomTag } from '@/types';
import { cn } from '@/lib/utils';
import { DayTagSelector } from './DayTagSelector';

interface DayHeaderProps {
  date: Date;
  dayName?: string;
  onGenerateName?: () => void;
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
  onGenerateName, 
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

  const inputWidth = `${Math.max((inputValue || placeholder).length, 8)}ch`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 text-center"
    >
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-1">
        {formattedDate}
      </div>
      
      {/* Day name with tag and icon — tag always visible when set, otherwise show selector on hover to add */}
      <div className="flex justify-center group">
        <div className="inline-flex items-center gap-3">
          {onSelectTag && (
            <div className={cn("flex-shrink-0 transition-all duration-300", currentTag ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
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
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={handleKeyDown}
              style={{ width: inputWidth }}
              className="text-3xl md:text-4xl font-serif font-bold text-foreground text-center border-none shadow-none bg-transparent focus-visible:ring-0 px-0 h-auto py-0 placeholder:text-muted-foreground min-w-[8ch]"
              placeholder={placeholder}
            />
          ) : (
            <h1 
              className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight hover:text-accent transition-colors cursor-pointer whitespace-nowrap"
              onClick={() => setIsEditing(true)}
            >
              {dayName || defaultName}
            </h1>
          )}

          {!isEditing && (
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
              {onGenerateName && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateName();
                  }}
                  className="p-1.5 rounded-full hover:bg-accent/20 text-accent hover:opacity-90"
                  title={language === 'zh' ? '为今天生成名称' : 'Generate a name for this day'}
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
