import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Mic, MicOff, Edit3, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScheduleEvent, AppLanguage } from '@/types';
import { generateDailySummary } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface DailyJournalProps {
  date: Date;
  events: ScheduleEvent[];
  initialSummary?: string;
  onSave: (summary: string) => void;
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
  date,
  events,
  initialSummary = '',
  onSave,
  language,
  isPast,
  dayName,
  dayNameIsManual,
  dayTag,
  energy,
  mood,
  focus,
}) => {
  const [summary, setSummary] = useState(initialSummary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H6',location:'DailyJournal.tsx:isListening-useEffect',message:'isListening state changed',data:{isListening,shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [isListening]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // #region agent log
    fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H1',location:'DailyJournal.tsx:SpeechRecognitionCheck',message:'speech recognition availability checked',data:{hasSpeechRecognition:!!SpeechRecognition,language},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H8',location:'DailyJournal.tsx:recognition-config',message:'recognition configured',data:{lang:recognition.lang,continuous:recognition.continuous,interimResults:recognition.interimResults,maxAlternatives:recognition.maxAlternatives,isMobile:/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    recognition.onstart = () => {
      // #region agent log
      fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H2',location:'DailyJournal.tsx:onstart',message:'recognition onstart fired',data:{shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let finalCount = 0;
      let interimCount = 0;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          finalCount += 1;
        } else {
          interimCount += 1;
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H9',location:'DailyJournal.tsx:onresult-meta',message:'recognition result meta',data:{resultIndex:event?.resultIndex,resultsLength:event?.results?.length ?? null,finalCount,interimCount,finalCharLen:finalTranscript.trim().length,containsCJK:/[\u3400-\u9FBF]/.test(finalTranscript),containsPunctuation:/[.,!?;:，。！？；：]/.test(finalTranscript),endsWithPunctuation:/[.,!?;:，。！？；：]\s*$/.test(finalTranscript),uiLanguage:language},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (finalTranscript) {
        setSummary(prev => {
          const normalized = finalTranscript.trim();
          const joiner = language === 'zh' ? '' : (prev ? ' ' : '');
          const next = `${prev}${joiner}${normalized}`;
          // #region agent log
          fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H10',location:'DailyJournal.tsx:onresult-apply',message:'final transcript applied to summary',data:{prevLen:prev.length,addedLen:normalized.length,nextLen:next.length,joinerType:language === 'zh' ? 'none' : 'space'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return next;
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      // #region agent log
      fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H4',location:'DailyJournal.tsx:onerror',message:'recognition error event',data:{error:event?.error,shouldListenBeforeReset:shouldListenRef.current,isListeningBeforeReset:isListening},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      shouldListenRef.current = false;
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError(language === 'zh' ? '无法访问麦克风。请检查浏览器权限。' : 'Microphone access denied. Please check permissions.');
      } else {
        setError(language === 'zh' ? '语音识别错误' : 'Speech recognition error');
      }
    };

    recognition.onend = () => {
      // #region agent log
      fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H3',location:'DailyJournal.tsx:onend',message:'recognition onend fired',data:{shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!shouldListenRef.current) {
        setIsListening(false);
        return;
      }
      // 部分浏览器会中途结束，这里按“持续监听意图”自动续接
      try {
        recognition.start();
      } catch {
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H3',location:'DailyJournal.tsx:onend-restart-catch',message:'restart after onend failed',data:{shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H2',location:'DailyJournal.tsx:toggleListening-entry',message:'toggle listening invoked',data:{isSpeechSupported,isListening,shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!isSpeechSupported) {
      setError(language === 'zh' ? '当前浏览器不支持语音输入，请尝试使用最新版本的 Chrome 或 Edge。' : 'Your browser does not support speech input. Please try a recent version of Chrome or Edge.');
      return;
    }
    if (isListening || shouldListenRef.current) {
      shouldListenRef.current = false;
      // #region agent log
      fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H7',location:'DailyJournal.tsx:toggleListening-stop-branch',message:'attempting recognition.stop',data:{hasRecognition:!!recognitionRef.current,isListening,shouldListenAfterSet:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      setIsEditing(true); // Auto-enable editing when speaking
      try {
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H7',location:'DailyJournal.tsx:toggleListening-start-before',message:'attempting recognition.start',data:{hasRecognition:!!recognitionRef.current,isListening,shouldListenAfterSet:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        recognitionRef.current?.start();
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H7',location:'DailyJournal.tsx:toggleListening-start-after',message:'recognition.start called without throw',data:{hasRecognition:!!recognitionRef.current,isListening,shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (e) {
        console.error("Failed to start recognition", e);
        // #region agent log
        fetch('http://127.0.0.1:7302/ingest/e34e5bd5-4320-4413-b8df-01e810a352dc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2683e'},body:JSON.stringify({sessionId:'c2683e',runId:'pre-fix',hypothesisId:'H5',location:'DailyJournal.tsx:toggleListening-start-catch',message:'start recognition threw',data:{error:e instanceof Error?e.message:String(e),isListening,shouldListen:shouldListenRef.current},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        shouldListenRef.current = false;
        setIsListening(false);
        setError(language === 'zh' ? '无法启动语音识别' : 'Failed to start speech recognition');
      }
    }
  };

  const handleGenerate = async () => {
    if (events.length === 0) return;
    setIsGenerating(true);
    try {
      const generated = await generateDailySummary(events, language, {
        dayName,
        dayNameIsManual,
        dayTag,
        energy,
        mood,
        focus,
        journal: summary || initialSummary,
      });
      setSummary(generated);
      onSave(generated);
      setIsEditing(true);
    } catch (error) {
      console.error("Failed to generate summary", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onSave(summary);
    setIsEditing(false);
  };

  const labels = {
    title: language === 'zh' ? '每日意义' : "Today's Meaning",
    generate: language === 'zh' ? '生成意义总结' : 'Generate meaning summary',
    edit: language === 'zh' ? '编辑' : 'Edit',
    save: language === 'zh' ? '保存' : 'Save',
    placeholder: language === 'zh' ? '今天对你意味着什么？写一句或一段…' : "What did today mean to you? Write a line or two…",
    listening: language === 'zh' ? '正在聆听…' : 'Listening…',
    emptyState: language === 'zh' ? '还没有意义总结。点击生成或开始写作。' : "No meaning summary yet. Generate one or start writing.",
  };

  const SNIPPETS = language === 'zh'
    ? ['今天最有意义的一刻是…', '我学到的一点是…', '明天我想带着的意义是…', '今天感谢的是…']
    : ["The most meaningful moment today…", "One thing I learned…", "The meaning I want to carry into tomorrow…", "I'm grateful for…"];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-[2rem] p-6 md:p-8 shadow-xl border border-border transition-all duration-500",
        "bg-surface",
        isPast ? "ring-4 ring-border/50" : ""
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <Edit3 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">{labels.title}</h2>
        </div>
        
        <div className="flex gap-2">
          {!summary && events.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="rounded-full border-border text-accent hover:bg-accent/20"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {labels.generate}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            disabled={!isSpeechSupported}
            className={cn(
              "rounded-full transition-colors",
              !isSpeechSupported
                ? "text-muted-foreground/50 cursor-not-allowed"
                : isListening
                  ? "bg-red-500/20 text-red-600 hover:bg-red-500/30"
                  : "text-muted-foreground hover:text-foreground"
            )}
            title={
              !isSpeechSupported
                ? (language === 'zh' ? '当前浏览器不支持语音输入' : 'Speech input is not supported in this browser')
                : isListening
                  ? (language === 'zh' ? '停止聆听' : 'Stop listening')
                  : (language === 'zh' ? '开始语音输入' : 'Start voice input')
            }
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          {isEditing ? (
            <Button size="sm" onClick={handleSave} className="rounded-full bg-accent hover:opacity-90 text-white">
              <Save className="w-4 h-4 mr-2" />
              {labels.save}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="rounded-full text-muted-foreground hover:text-accent">
              <Edit3 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {/* Snippet quick-insert buttons */}
          <div className="flex flex-wrap gap-1.5">
            {SNIPPETS.map(snippet => (
              <button
                key={snippet}
                onClick={() => setSummary(prev => prev ? `${prev}\n${snippet}` : snippet)}
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
              placeholder={labels.placeholder}
              className="min-h-[200px] text-lg leading-relaxed bg-field border-border focus:border-accent focus:ring-accent/30 rounded-xl resize-none p-4 font-sans text-foreground"
            />
            {error && (
              <div className="absolute bottom-4 left-4 text-xs font-medium text-red-500">
                {error}
              </div>
            )}
            {isListening && (
              <div className="absolute bottom-4 right-4 text-xs font-medium text-red-500 animate-pulse flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                {labels.listening}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setIsEditing(true)}
          className="min-h-[120px] text-lg leading-relaxed text-muted-foreground font-sans cursor-text hover:bg-field/50 p-4 rounded-xl transition-colors -ml-4"
        >
          {summary ? (
            summary.split('\n').map((line, i) => (
              <p key={i} className="mb-2 text-foreground">{line}</p>
            ))
          ) : (
            <span className="text-muted-foreground italic">{labels.emptyState}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
