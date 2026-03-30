import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScheduleEvent, AppLanguage } from '@/types';
import { cn } from '@/lib/utils';

const SAVE_DEBOUNCE_MS = 450;

interface DailyJournalProps {
  date: Date;
  /** yyyy-MM-dd — used so auto-save targets the correct day when flushing */
  entryDateKey: string;
  events: ScheduleEvent[];
  initialSummary?: string;
  onSave: (summary: string, entryDateKey: string) => void;
  language: AppLanguage;
  isPast: boolean;
  dayName?: string;
  dayNameIsManual?: boolean;
  dayTag?: string;
  energy?: number;
  mood?: number;
  focus?: number;
}

export const DailyJournal: React.FC<DailyJournalProps> = ({
  date: _date,
  entryDateKey,
  events: _events,
  initialSummary = '',
  onSave,
  language,
  isPast,
  dayName: _dayName,
  dayNameIsManual: _dayNameIsManual,
  dayTag: _dayTag,
  energy: _energy,
  mood: _mood,
  focus: _focus,
}) => {
  const [summary, setSummary] = useState(initialSummary);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const lastSavedRef = useRef(initialSummary);
  const summaryRef = useRef(initialSummary);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  summaryRef.current = summary;

  useEffect(() => {
    setSummary(initialSummary);
    lastSavedRef.current = initialSummary;
  }, [initialSummary]);

  const persistIfDirty = useCallback(
    (value: string) => {
      if (value === lastSavedRef.current) return;
      lastSavedRef.current = value;
      onSave(value, entryDateKey);
    },
    [onSave, entryDateKey]
  );

  useEffect(() => {
    if (summary === lastSavedRef.current) return;
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      persistIfDirty(summary);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [summary, persistIfDirty]);

  const entryDateKeyRef = useRef(entryDateKey);
  entryDateKeyRef.current = entryDateKey;

  useEffect(() => {
    return () => {
      const latest = summaryRef.current;
      if (latest !== lastSavedRef.current) {
        lastSavedRef.current = latest;
        onSave(latest, entryDateKeyRef.current);
      }
    };
  }, [onSave]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    setIsSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setSummary((prev) => {
          const normalized = finalTranscript.trim();
          const joiner = language === 'zh' ? '' : prev ? ' ' : '';
          return `${prev}${joiner}${normalized}`;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      shouldListenRef.current = false;
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError(language === 'zh' ? '无法访问麦克风。请检查浏览器权限。' : 'Microphone access denied. Please check permissions.');
      } else {
        setError(language === 'zh' ? '语音识别错误' : 'Speech recognition error');
      }
    };

    recognition.onend = () => {
      if (!shouldListenRef.current) {
        setIsListening(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      setIsListening(false);
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    };
  }, [language]);

  const toggleListening = () => {
    setError(null);
    if (!isSpeechSupported) {
      setError(
        language === 'zh'
          ? '当前浏览器不支持语音输入，请尝试使用最新版本的 Chrome 或 Edge。'
          : 'Your browser does not support speech input. Please try a recent version of Chrome or Edge.'
      );
      return;
    }
    if (isListening || shouldListenRef.current) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error('Failed to start recognition', e);
        shouldListenRef.current = false;
        setIsListening(false);
        setError(language === 'zh' ? '无法启动语音识别' : 'Failed to start speech recognition');
      }
    }
  };

  const handleBlur = () => {
    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    persistIfDirty(summaryRef.current);
  };

  const labels = {
    title: language === 'zh' ? '每日意义' : "Today's Meaning",
    placeholder:
      language === 'zh' ? '今天对你意味着什么？写一句或一段…（自动保存）' : 'What did today mean to you? A line or two… (saved automatically)',
    listening: language === 'zh' ? '正在聆听…' : 'Listening…',
  };

  const SNIPPETS =
    language === 'zh'
      ? ['今天最有意义的一刻是…', '我学到的一点是…', '明天我想带着的意义是…', '今天感谢的是…']
      : [
          'The most meaningful moment today…',
          'One thing I learned…',
          'The meaning I want to carry into tomorrow…',
          "I'm grateful for…",
        ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-[2rem] p-4 md:p-8 shadow-xl border border-border transition-all duration-500 max-w-full min-w-0 overflow-hidden',
        'bg-surface',
        isPast ? 'ring-4 ring-border/50' : ''
      )}
    >
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">{labels.title}</h2>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            disabled={!isSpeechSupported}
            className={cn(
              'rounded-full transition-colors',
              !isSpeechSupported
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : isListening
                  ? 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
                  : 'text-muted-foreground hover:text-foreground'
            )}
            title={
              !isSpeechSupported
                ? language === 'zh'
                  ? '当前浏览器不支持语音输入'
                  : 'Speech input is not supported in this browser'
                : isListening
                  ? language === 'zh'
                    ? '停止聆听'
                    : 'Stop listening'
                  : language === 'zh'
                    ? '开始语音输入'
                    : 'Start voice input'
            }
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SNIPPETS.map((snippet) => (
            <button
              key={snippet}
              type="button"
              onClick={() => setSummary((prev) => (prev ? `${prev}\n${snippet}` : snippet))}
              className="text-xs px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 border border-border transition-colors"
            >
              {snippet}
            </button>
          ))}
        </div>
        <div className="relative">
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={handleBlur}
            placeholder={labels.placeholder}
            className="min-h-[120px] md:min-h-[200px] max-h-[min(50vh,320px)] overflow-y-auto text-lg leading-relaxed bg-field border-border focus:border-accent focus:ring-accent/30 rounded-xl resize-none p-4 font-sans text-foreground"
          />
          {error && (
            <div className="absolute bottom-4 left-4 text-xs font-medium text-red-500">{error}</div>
          )}
          {isListening && (
            <div className="absolute bottom-4 right-4 text-xs font-medium text-red-500 animate-pulse flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              {labels.listening}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
