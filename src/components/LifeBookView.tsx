import React, { useRef, useCallback, useState, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import { Keyboard } from 'swiper/modules';
import 'swiper/css';

import type { SavedChapter } from '@/lib/chaptersStorage';
import {
  buildLifeBookPlainText,
  exportLifeBookToTxt,
  exportLifeBookToMd,
  countLifeBookNarrativeChars,
} from '@/lib/chaptersStorage';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { LifeBookCover } from '@/components/lifebook/LifeBookCover';
import { LifeBookTOC } from '@/components/lifebook/LifeBookTOC';
import { LifeBookChapterSpread } from '@/components/lifebook/LifeBookChapterSpread';
import { LifeBookEndPage } from '@/components/lifebook/LifeBookEndPage';
import { LifeBookBackCover } from '@/components/lifebook/LifeBookBackCover';
import { LifeBookEmptyCover } from '@/components/lifebook/LifeBookEmptyCover';
import { Button } from '@/components/ui/button';
import { Download, Copy, FileCode } from 'lucide-react';

export interface LifeBookViewProps {
  chapters: SavedChapter[];
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  onClose: () => void;
  userDisplayName?: string;
}

export const LifeBookView: React.FC<LifeBookViewProps> = ({
  chapters,
  events,
  completedInstances: _completedInstances,
  language,
  onClose: _onClose,
  userDisplayName,
}) => {
  const swiperRef = useRef<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const isZh = language === 'zh';
  const exportLang = isZh ? 'zh' : 'en';

  const narrativeChars = useMemo(() => countLifeBookNarrativeChars(chapters), [chapters]);

  const goToPage = useCallback((index: number) => {
    swiperRef.current?.slideTo(index);
  }, []);

  const handleExportTxt = useCallback(() => {
    exportLifeBookToTxt(chapters, { language: exportLang });
  }, [chapters, exportLang]);

  const handleExportMd = useCallback(() => {
    exportLifeBookToMd(chapters, { language: exportLang });
  }, [chapters, exportLang]);

  const handleCopyFullBook = useCallback(async () => {
    const text = buildLifeBookPlainText(chapters, { language: exportLang });
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(isZh ? '已复制' : 'Copied');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(isZh ? '复制失败' : 'Copy Failed');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [chapters, exportLang, isZh]);

  if (chapters.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center p-4 max-md:min-h-[calc(60vh*1.2)] md:p-6">
        <div className="w-[min(50vw,100%)] max-w-full min-w-0">
          <LifeBookEmptyCover language={language} />
        </div>
      </div>
    );
  }

  const totalSlides = 2 + chapters.length + 2; // cover, toc, chapters, end, back
  const isSlideVisible = (index: number) => Math.abs(index - activeIndex) <= 1;

  const renderSlideContent = (index: number) => {
    if (!isSlideVisible(index)) return null;
    if (index === 0) {
      return (
        <LifeBookCover
          userDisplayName={userDisplayName}
          chapters={chapters}
          events={events}
          language={language}
        />
      );
    }
    if (index === 1) {
      return (
        <LifeBookTOC chapters={chapters} language={language} onGoToPage={goToPage} />
      );
    }
    if (index >= 2 && index < 2 + chapters.length) {
      const ch = chapters[index - 2];
      return <LifeBookChapterSpread chapter={ch} language={language} />;
    }
    if (index === totalSlides - 2) return <LifeBookEndPage language={language} />;
    if (index === totalSlides - 1) return <LifeBookBackCover language={language} />;
    return null;
  };

  const pageWrapperClass =
    'relative w-full h-full p-4 md:p-6 flex items-center justify-center overflow-auto rounded-xl transition-[box-shadow,transform] duration-150 hover:shadow-lg active:translate-y-0.5 active:shadow-md';
  const pageWrapperStyle = {
    boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  };
  const showPageNumber = (index: number) => index > 0 && index < totalSlides - 1;
  const pageNumberPosition = (index: number) => (index % 2 === 1 ? 'right' : 'left');

  const sidePanel = (
    <aside className="flex w-full max-w-[min(100%,280px)] flex-col gap-3 md:shrink-0 md:justify-center md:pl-2">
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="feather"
          size="sm"
          className="gap-1.5 justify-start"
          onClick={handleExportTxt}
          aria-label={isZh ? '导出全书为 TXT' : 'Export Full Book As TXT'}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          {isZh ? '导出 TXT' : 'Export As TXT'}
        </Button>
        <Button
          type="button"
          variant="feather"
          size="sm"
          className="gap-1.5 justify-start"
          onClick={handleExportMd}
          aria-label={isZh ? '导出全书为 Markdown' : 'Export Full Book As Markdown'}
        >
          <FileCode className="h-4 w-4 shrink-0" aria-hidden />
          {isZh ? '导出 Markdown' : 'Export Markdown'}
        </Button>
        <Button
          type="button"
          variant="feather"
          size="sm"
          className="gap-1.5 justify-start"
          onClick={handleCopyFullBook}
          aria-label={isZh ? '复制全书正文' : 'Copy Full Book'}
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden />
          {isZh ? '复制全书' : 'Copy Full Book'}
        </Button>
      </div>
      <p className="text-left text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
        {isZh
          ? `共 ${chapters.length} 章 · 叙事约 ${narrativeChars} 字`
          : `${chapters.length} Chapters · ~${narrativeChars} Characters In Narrative`}
      </p>
      {copyFeedback && (
        <p className="text-left text-xs font-medium text-accent" role="status">
          {copyFeedback}
        </p>
      )}
      <p className="text-left text-[11px] leading-relaxed" style={{ color: 'var(--app-muted)' }}>
        {isZh ? '可用左右方向键或滑动翻页。' : 'Use Arrow Keys Or Swipe To Turn Pages.'}
      </p>
    </aside>
  );

  return (
    <div className="flex w-full flex-col items-center justify-center gap-6 md:flex-row md:items-center md:justify-center md:gap-8 md:px-4">
      {/* Book: restore pre-toolbar layout — full column height for the swiper area */}
      <div
        className="flex h-[82vh] max-md:h-[calc(82vh*1.2)] min-h-[420px] w-full min-w-0 flex-col items-center justify-center"
      >
        <div
          className="relative flex min-h-0 w-[min(50vw,100%)] max-w-full flex-1 items-center justify-center"
          style={{
            aspectRatio: '185 / 260',
            maxHeight: '100%',
          }}
        >
          <Swiper
            modules={[Keyboard]}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              setActiveIndex(swiper.activeIndex);
            }}
            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
            speed={400}
            className="!h-full"
            style={{ height: '100%' }}
            allowTouchMove
            keyboard={{ enabled: true }}
            grabCursor
          >
            {Array.from({ length: totalSlides }, (_, index) => (
              <SwiperSlide key={index} className="!h-full">
                <div className={pageWrapperClass} style={pageWrapperStyle}>
                  {renderSlideContent(index)}
                  {showPageNumber(index) && (
                    <span
                      className="absolute bottom-3 text-xs text-muted-foreground"
                      style={{ [pageNumberPosition(index)]: '1rem' }}
                      aria-hidden
                    >
                      {index}
                    </span>
                  )}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      {sidePanel}
    </div>
  );
};
