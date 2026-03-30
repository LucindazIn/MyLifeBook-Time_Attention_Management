import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Plus, X } from 'lucide-react';
import { AppLanguage, CustomTag } from '@/types';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_TAGS: CustomTag[] = [
  { id: 'default-1', icon: '💗', name: 'Love' },
  { id: 'default-2', icon: '💪', name: 'Workout' },
  { id: 'default-3', icon: '🌟', name: 'Star' },
  { id: 'default-4', icon: '☕', name: 'Coffee' },
  { id: 'default-5', icon: '🎨', name: 'Art' },
  { id: 'default-6', icon: '🧘', name: 'Relax' },
  { id: 'default-7', icon: '🚀', name: 'Launch' },
  { id: 'default-8', icon: '📚', name: 'Study' },
  { id: 'default-9', icon: '🎉', name: 'Party' },
  { id: 'default-10', icon: '😴', name: 'Sleep' },
  { id: 'default-11', icon: '💻', name: 'Work' },
  { id: 'default-12', icon: '🏃', name: 'Run' },
];

interface DayTagSelectorProps {
  currentTag?: string;
  onSelectTag: (tag: string) => void;
  language: AppLanguage;
  customTags?: CustomTag[];
  onAddCustomTag?: (tag: CustomTag) => void;
  onRemoveCustomTag?: (id: string) => void;
}

export const DayTagSelector: React.FC<DayTagSelectorProps> = ({ 
  currentTag, 
  onSelectTag, 
  language,
  customTags = [],
  onAddCustomTag,
  onRemoveCustomTag
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTagIcon, setNewTagIcon] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const allTags = [...DEFAULT_TAGS, ...customTags];

  // Position dropdown when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = 280;
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2 - width / 2,
      });
    } else if (!isOpen) {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePointerOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || portalRef.current?.contains(target)) return;
      setIsOpen(false);
      setIsAdding(false);
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerOutside, true);
    }
    return () => document.removeEventListener('pointerdown', handlePointerOutside, true);
  }, [isOpen]);

  const handleAddTag = () => {
    if (newTagIcon.trim() && newTagName.trim() && onAddCustomTag) {
      // Extract just the first emoji/character if user pasted multiple
      const icon = Array.from(newTagIcon.trim())[0] || '✨';
      onAddCustomTag({
        id: uuidv4(),
        icon,
        name: newTagName.trim()
      });
      setNewTagIcon('');
      setNewTagName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex w-8 h-8 items-center justify-center transition-colors rounded-full text-accent border border-transparent shadow-none hover:bg-accent/20 active:bg-accent/30'
        )}
        title={language === 'zh' ? '给今天打个标签' : 'Tag the day'}
      >
        {currentTag ? (
          <span className="text-base leading-none">{currentTag}</span>
        ) : (
          <Tag className="w-3.5 h-3.5" />
        )}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={portalRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{
              position: 'fixed',
              top: dropdownPosition?.top ?? 0,
              left: dropdownPosition != null
                ? Math.max(8, Math.min(dropdownPosition.left, window.innerWidth - 280 - 8))
                : 0,
              zIndex: 9999,
            }}
            className="bg-surface rounded-2xl shadow-xl border border-border p-3 w-[280px]"
          >
            {isAdding ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">
                    {language === 'zh' ? '创建新标签' : 'Create New Tag'}
                  </span>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagIcon}
                    onChange={(e) => setNewTagIcon(e.target.value)}
                    placeholder="🌟"
                    className="w-12 h-12 text-center text-2xl rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent shadow-sm bg-field"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={language === 'zh' ? '标签名称' : 'Tag Name'}
                    className="flex-1 h-12 px-3 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-accent shadow-sm bg-field"
                  />
                </div>
                <button
                  onClick={handleAddTag}
                  disabled={!newTagIcon.trim() || !newTagName.trim()}
                  className="w-full py-2.5 bg-[#9b87f5] text-white text-sm font-medium rounded-xl hover:bg-[#8b77e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {language === 'zh' ? '保存标签' : 'Save Tag'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {language === 'zh' ? '选择一个标签' : 'Select a tag'}
                  </span>
                  {currentTag && (
                    <button 
                      onClick={() => { onSelectTag(''); setIsOpen(false); }}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      {language === 'zh' ? '清除' : 'Clear'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-1">
                  {allTags.map(tag => (
                    <div key={tag.id} className="relative group">
                      <button
                        onClick={() => {
                          onSelectTag(currentTag === tag.icon ? '' : tag.icon);
                          setIsOpen(false);
                        }}
                        title={tag.name}
                        className={cn(
                          "w-12 h-12 flex items-center justify-center text-2xl rounded-xl transition-all w-full",
                          currentTag === tag.icon 
                            ? "bg-accent/20 border-2 border-accent scale-105" 
                            : "hover:bg-field border-2 border-transparent hover:scale-110"
                        )}
                      >
                        {tag.icon}
                      </button>
                      {onRemoveCustomTag && customTags.find(t => t.id === tag.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCustomTag(tag.id);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {onAddCustomTag && (
                    <button
                      onClick={() => setIsAdding(true)}
                      className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent hover:bg-accent/20 transition-all"
                      title={language === 'zh' ? '添加自定义标签' : 'Add custom tag'}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
