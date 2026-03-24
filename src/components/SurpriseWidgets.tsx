import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Quote, Music, Image as ImageIcon, Play, Pause, RefreshCw } from 'lucide-react';
import { AppTheme, AppLanguage } from '@/types';
import { getQuote as getLocalQuote, setQuote as setLocalQuote } from '@/lib/repositories/quoteRepo';

interface SurpriseWidgetsProps {
  theme?: AppTheme;
  language?: AppLanguage;
  dateKey: string; // yyyy-MM-dd
  quoteStore?: {
    get: (dateKey: string) => Promise<{ text: string; author?: string } | null>;
    set: (dateKey: string, quote: { text: string; author?: string }) => Promise<void>;
  };
}

// Mock data for quotes
const QUOTES: Record<AppTheme, Record<AppLanguage, { text: string; author: string }[]>> = {
  tech: {
    en: [
      { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
      { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
      { text: "Software is eating the world.", author: "Marc Andreessen" },
      { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke" }
    ],
    zh: [
      { text: "预测未来的最好方法就是去创造它。", author: "艾伦·凯" },
      { text: "空谈误国，实干兴邦 (Talk is cheap. Show me the code).", author: "莱纳斯·托瓦兹" },
      { text: "软件正在吞噬世界。", author: "马克·安德森" },
      { text: "任何足够先进的技术都与魔法无异。", author: "亚瑟·C·克拉克" }
    ]
  },
  artsy: {
    en: [
      { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
      { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
      { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
      { text: "Everything you can imagine is real.", author: "Pablo Picasso" }
    ],
    zh: [
      { text: "困难之中蕴藏着机会。", author: "爱因斯坦" },
      { text: "生活就是当你忙着制定其他计划时发生的事情。", author: "约翰·列侬" },
      { text: "我们生活的目的是快乐。", author: "达赖喇嘛" },
      { text: "你能想象的一切都是真实的。", author: "毕加索" }
    ]
  },
  anime: {
    en: [
      { text: "Whatever you lose, you'll find it again. But what you throw away you'll never get back.", author: "Kenshin Himura" },
      { text: "If you don't take risks, you can't create a future.", author: "Monkey D. Luffy" },
      { text: "Hard work betrays none, but dreams betray many.", author: "Hachiman Hikigaya" },
      { text: "A dropout will beat a genius through hard work.", author: "Rock Lee" }
    ],
    zh: [
      { text: "失去的东西总会找回来，但抛弃的东西永远回不来了。", author: "绯村剑心" },
      { text: "如果不去冒险，就无法创造未来。", author: "蒙奇·D·路飞" },
      { text: "努力不会背叛人，但梦想会背叛许多人。", author: "比企谷八幡" },
      { text: "吊车尾通过努力也能击败天才。", author: "洛克·李" }
    ]
  },
  minimalist: {
    en: [
      { text: "Less is more.", author: "Mies van der Rohe" },
      { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
      { text: "The ability to simplify means to eliminate the unnecessary so that the necessary may speak.", author: "Hans Hofmann" },
      { text: "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupéry" }
    ],
    zh: [
      { text: "少即是多。", author: "密斯·凡·德·罗" },
      { text: "简约是极致的复杂。", author: "达芬奇" },
      { text: "简化的能力意味着消除不必要的东西，以便让必要的东西说话。", author: "汉斯·霍夫曼" },
      { text: "完美的达成，不是当没有什么可以添加时，而是当没有什么可以去掉时。", author: "安托万·德·圣埃克苏佩里" }
    ]
  },
  nature: {
    en: [
      { text: "Look deep into nature, and then you will understand everything better.", author: "Albert Einstein" },
      { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
      { text: "In every walk with nature one receives far more than he seeks.", author: "John Muir" },
      { text: "The earth has music for those who listen.", author: "Shakespeare" }
    ],
    zh: [
      { text: "深入观察自然，你就会更好地理解一切。", author: "爱因斯坦" },
      { text: "大自然不匆忙，但一切都完成了。", author: "老子" },
      { text: "在与自然的每一次散步中，人得到的远比寻找的多。", author: "约翰·缪尔" },
      { text: "地球为那些倾听的人演奏音乐。", author: "莎士比亚" }
    ]
  },
  retro: {
    en: [
      { text: "Life moves pretty fast. If you don't stop and look around once in a while, you could miss it.", author: "Ferris Bueller" },
      { text: "May the Force be with you.", author: "Star Wars" },
      { text: "Nobody puts Baby in a corner.", author: "Dirty Dancing" },
      { text: "I feel the need... the need for speed!", author: "Top Gun" }
    ],
    zh: [
      { text: "生活过得很快。如果你不偶尔停下来看看周围，你可能会错过它。", author: "费里斯·布勒" },
      { text: "愿原力与你同在。", author: "星球大战" },
      { text: "没人能把Baby放在角落里。", author: "辣身舞" },
      { text: "我感到需要……对速度的渴望！", author: "壮志凌云" }
    ]
  }
};

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

export const SurpriseWidgets: React.FC<SurpriseWidgetsProps> = ({ theme = 'artsy', language = 'en', dateKey, quoteStore }) => {
  const [quote, setQuote] = useState(QUOTES[theme][language][0]);
  const [hasSavedDailyQuote, setHasSavedDailyQuote] = useState(false);
  const [visualSeed, setVisualSeed] = useState(Date.now());
  const [song, setSong] = useState(SONGS[theme][0]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Randomize on mount or theme change
    const themeQuotes = QUOTES[theme][language];
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
        setQuote(themeQuotes[Math.floor(Math.random() * themeQuotes.length)]);
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
    const themeQuotes = QUOTES[theme][language];
    const next = themeQuotes[Math.floor(Math.random() * themeQuotes.length)];
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
