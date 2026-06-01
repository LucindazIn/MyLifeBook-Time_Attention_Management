import { useState, useCallback } from 'react';
import type { ChapterPeriodKey } from '@/lib/dateRange';
import type { TagAnalysisFilterState, TagAnalysisViewMode } from '@/lib/tagAnalysisQuery';

const DEFAULT_FILTERS: TagAnalysisFilterState = {
  range: 'this_month',
  viewMode: 'untagged',
};

export function useTagAnalysisFilters(initial?: Partial<TagAnalysisFilterState>) {
  const [filters, setFilters] = useState<TagAnalysisFilterState>({
    ...DEFAULT_FILTERS,
    ...initial,
  });

  const setRange = useCallback((range: ChapterPeriodKey) => {
    setFilters((prev) => ({ ...prev, range }));
  }, []);

  const setViewMode = useCallback((viewMode: TagAnalysisViewMode) => {
    setFilters((prev) => ({ ...prev, viewMode }));
  }, []);

  const resetFilters = useCallback((partial?: Partial<TagAnalysisFilterState>) => {
    setFilters({ ...DEFAULT_FILTERS, ...partial });
  }, []);

  return { filters, setFilters, setRange, setViewMode, resetFilters };
}
