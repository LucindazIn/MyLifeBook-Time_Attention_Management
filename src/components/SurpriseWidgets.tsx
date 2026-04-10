import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Quote, Music, Image as ImageIcon, Play, Pause, RefreshCw } from 'lucide-react';
import { AppTheme, AppLanguage } from '@/types';
import { getQuote as getLocalQuote, setQuote as setLocalQuote } from '@/lib/repositories/quoteRepo';
import { pickRandomDailyQuote } from '@/lib/dailyQuotePools';

interface SurpriseWidgetsProps {
  theme?: AppTheme;
  language?: AppLanguage;
  dateKey: string; // yyyy-MM-dd
  quoteStore?: {
    get: (dateKey: string) => Promise<{ text: string; author?: string } | null>;
    set: (dateKey: string, quote: { text: string; author?: string }) => Promise<void>;
  };
}

// Mock data for songs (using YouTube IDs for safe embedding or just simulation)
const SONGS: Record<AppTheme, { title: string; artist: string; url: string }[]> = {
  tech: [
    { title: "Synthwave Mix", artist: "Retro Future", url: "https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1" },
    { title: "Coding Focus", artist: "Dev Tunes", url: "https://www.youtube.com/embed/M5QY2_8704o?autoplay=1" }
  ],
  artsy: [
    { title: "Lofi Chill", artist: "Lofi Girl", url: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1" },
    { title: "Piano Focus", artist: "Relaxing Music", url: "https://www.youtube.com/embed/WJ3-F02-F_Y?autoplay=1" }
  ],
  anime: [
    { title: "Anime Openings", artist: "J-Pop Best", url: "https://www.youtube.com/embed/4JNtAtGGNRU?autoplay=1" },
    { title: "Ghibli Piano", artist: "Studio Ghibli", url: "https://www.youtube.com/embed/0K8j6-5yWc4?autoplay=1" }
  ],
  minimalist: [
    { title: "White Noise", artist: "Focus", url: "https://www.youtube.com/embed/NMthTLTZF1w?autoplay=1" },
    { title: "Deep Focus", artist: "Ambient", url: "https://www.youtube.com/embed/84X7bO3gqPU?autoplay=1" }
  ],
  nature: [
    { title: "Forest Sounds", artist: "Nature", url: "https://www.youtube.com/embed/xNN7iTA57jM?autoplay=1" },
    { title: "Rain Sounds", artist: "Relax", url: "https://www.youtube.com/embed/mPZkdNFkNps?autoplay=1" }
  ],
  retro: [
    { title: "80s Hits", artist: "Retro", url: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" },
    { title: "Oldies", artist: "Classics", url: "https://www.youtube.com/embed/fJ9rUzIMcZQ?autoplay=1" }
  ]
};

const VISUAL_SEEDS: Record<AppTheme, string> = {
  tech: "technology",
  artsy: "art",
  anime: "japan",
  minimalist: "minimal",
  nature: "nature",
  retro: "vintage"
};

export const SurpriseWidgets: React.FC<SurpriseWidgetsProps> = ({
  theme = 'artsy',
  language: languageProp,
  dateKey,
  quoteStore,
}) => {
  const language: AppLanguage = languageProp ?? 'en';
  const [quote, setQuote] = useState<{ text: string; author: string }>(() => pickRandomDailyQuote(language));
  const [hasSavedDailyQuote, setHasSavedDailyQuote] = useState(false);
  const [visualSeed, setVisualSeed] = useState(Date.now());
  const [song, setSong] = useState(SONGS[theme][0]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const themeSongs = SONGS[theme];

    let cancelled = false;
    (async () => {
      const savedRemote = quoteStore ? await quoteStore.get(dateKey) : null;
      const savedLocal = savedRemote ? null : getLocalQuote(dateKey);
      const text = savedRemote?.text || savedLocal?.text;
      const author = savedRemote?.author || savedLocal?.author;

      if (cancelled) return;
      if (text) {
        setQuote({ text, author: author || (language === 'zh' ? '佚名' : 'Anonymous') });
        setHasSavedDailyQuote(true);
      } else {
        setQuote(pickRandomDailyQuote(language));
        setHasSavedDailyQuote(false);
      }
    })();
    setVisualSeed(Math.floor(Math.random() * 1000));
    setSong(themeSongs[Math.floor(Math.random() * themeSongs.length)]);
    setIsPlaying(false);
    return () => {
      cancelled = true;
    };
  }, [theme, language, dateKey, quoteStore]);

  const refreshQuote = () => {
    const next = pickRandomDailyQuote(language);
    if (hasSavedDailyQuote) {
      const ok = window.confirm(language === 'zh' ? '这会替换你今天保存的 Quote。确定吗？' : "This will replace today's saved quote. Continue?");
      if (!ok) return;
      if (quoteStore) {
        quoteStore.set(dateKey, { text: next.text, author: next.author }).catch(() => {});
        setQuote(next);
      } else {
        setQuote(setLocalQuote(dateKey, { text: next.text, author: next.author }));
      }
      setHasSavedDailyQuote(true);
      return;
    }
    setQuote(next);
  };

  const refreshVisual = () => setVisualSeed(Math.floor(Math.random() * 1000));
  
  const refreshSong = () => {
    const themeSongs = SONGS[theme];
    setSong(themeSongs[Math.floor(Math.random() * themeSongs.length)]);
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Quote + Visual side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Quote Widget */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col"
          style={{ background: 'var(--app-surface)' }}
        >
          <div className="absolute top-2.5 right-2.5">
            <button onClick={refreshQuote} className="p-1.5 hover:bg-field rounded-full transition-colors" title={language === 'zh' ? '换一条' : 'Shuffle'}>
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <Quote className="w-4 h-4 text-muted-foreground mb-3 opacity-50 flex-shrink-0" />
          <p className="font-serif text-sm text-foreground italic leading-relaxed flex-1">
            "{quote.text}"
          </p>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-3">
            — {quote.author}
          </p>
          {hasSavedDailyQuote && (
            <div className="mt-2 text-[10px] text-muted-foreground/80">
              {language === 'zh' ? '已保存' : 'Saved'}
            </div>
          )}
        </motion.div>

        {/* Visual Widget */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="rounded-2xl p-0.5 shadow-sm relative overflow-hidden"
          style={{ background: 'var(--app-surface)' }}
        >
          <div className="absolute top-2.5 right-2.5 z-10">
            <button onClick={refreshVisual} className="p-1.5 bg-field hover:bg-surface rounded-full transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-foreground" />
            </button>
          </div>
          <img 
            src={`https://picsum.photos/seed/${VISUAL_SEEDS[theme]}${visualSeed}/300/300`} 
            alt="Inspiring Visual" 
            className="w-full h-full object-cover rounded-[0.9rem] opacity-90 hover:opacity-100 transition-opacity"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-2.5 left-2.5 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-border">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3 text-foreground" />
              <span className="text-[11px] font-medium text-foreground">{language === 'zh' ? '每日灵感' : 'Inspiration'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Song Widget */}
      <motion.div 
        whileHover={{ y: -3 }}
        className="rounded-2xl p-4 shadow-sm relative overflow-hidden"
        style={{ background: 'var(--app-surface)' }}
      >
        <div className="absolute top-2.5 right-2.5 z-10">
          <button onClick={refreshSong} className="p-1.5 hover:bg-field rounded-full transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-field rounded-full flex items-center justify-center text-foreground flex-shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground text-sm truncate">{song.title}</h3>
            <p className="text-muted-foreground text-xs truncate">{song.artist}</p>
          </div>
        </div>

        {isPlaying ? (
          <div className="rounded-xl overflow-hidden shadow-inner bg-black/10 aspect-video relative">
            <iframe 
              width="100%" 
              height="100%" 
              src={song.url} 
              title="YouTube video player" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              className="absolute inset-0"
            ></iframe>
            <button 
              onClick={() => setIsPlaying(false)}
              className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 z-20"
            >
              <Pause className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsPlaying(true)}
            className="w-full bg-field hover:bg-surface transition-colors py-2 rounded-xl flex items-center justify-center gap-2 text-foreground font-medium text-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {language === 'zh' ? '播放' : 'Play Song'}
          </button>
        )}
      </motion.div>
    </div>
  );
};
