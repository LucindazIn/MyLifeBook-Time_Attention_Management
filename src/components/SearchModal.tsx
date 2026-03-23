import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search as SearchIcon, Tag as TagIcon, FilterX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScheduleEvent, AppLanguage } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { expandRecurringEvents } from '@/lib/events';
import { PRESET_ROLES } from '@/lib/constants/roles';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScheduleEvent[];
  language: AppLanguage;
  onEventClick: (date: Date) => void;
  completedInstances: Record<string, boolean>;
  onHighlightsChange?: (dates: string[]) => void;
  selectedFilterRole?: string | null;
  onRoleFilterChange?: (roleId: string | null) => void;
  roleFilterMode?: 'all' | 'dim' | 'hide';
  onRoleFilterModeChange?: (mode: 'all' | 'dim' | 'hide') => void;
  getRoleColor?: (roleId: string) => string;
  getRoleDisplayName?: (roleId: string, lang: AppLanguage) => string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  events,
  language,
  onEventClick,
  completedInstances,
  onHighlightsChange,
  selectedFilterRole = null,
  onRoleFilterChange,
  roleFilterMode = 'dim',
  onRoleFilterModeChange,
  getRoleColor = (_roleId: string) => 'var(--app-accent)',
  getRoleDisplayName = (id: string, _lang: AppLanguage) => id,
}) => {
  const [query, setQuery] = useState('');

  // Expand events for a reasonable range (e.g., past year to next year) to allow searching recurring events
  const searchRangeStart = new Date();
  searchRangeStart.setFullYear(searchRangeStart.getFullYear() - 1);
  const searchRangeEnd = new Date();
  searchRangeEnd.setFullYear(searchRangeEnd.getFullYear() + 1);

  const allExpandedEvents = useMemo(() => {
    if (!isOpen) return [];
    return expandRecurringEvents(events, searchRangeStart, searchRangeEnd, completedInstances);
  }, [events, isOpen, completedInstances]);

  const uniqueRolesInEvents = useMemo(() => {
    const ids = new Set<string>();
    allExpandedEvents.forEach((e) => {
      if (e.role) ids.add(e.role);
    });
    return Array.from(ids);
  }, [allExpandedEvents]);

  const roleOptions = useMemo(() => {
    const presetIds = new Set(PRESET_ROLES.map((r) => r.id));
    const custom = uniqueRolesInEvents.filter((id) => !presetIds.has(id));
    return [...PRESET_ROLES.map((r) => r.id), ...custom];
  }, [uniqueRolesInEvents]);

  const searchResults = useMemo(() => {
    let list = allExpandedEvents;
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      list = list.filter((event) => {
        const matchTitle = event.title.toLowerCase().includes(lowerQuery);
        const matchDesc = event.description?.toLowerCase().includes(lowerQuery);
        const matchEventTag = event.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery));
        const matchLabel = event.label?.text?.toLowerCase().includes(lowerQuery);
        const matchRole = event.role && getRoleDisplayName(event.role, language).toLowerCase().includes(lowerQuery);
        const matchLongTermGoal = event.longTermGoals?.some((g) => g.toLowerCase().includes(lowerQuery));
        return matchTitle || matchDesc || matchEventTag || matchLabel || matchRole || matchLongTermGoal;
      });
    }
    if (selectedFilterRole) {
      list = list.filter((e) => e.role === selectedFilterRole);
    }
    return [...list].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [query, allExpandedEvents, selectedFilterRole, language, getRoleDisplayName]);

  const tagCounts = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase().trim();
    const isEventTagMatch = allExpandedEvents.some((e) =>
      e.label?.text?.toLowerCase() === q || e.tags?.some((t) => t.toLowerCase() === q)
    );
    if (!isEventTagMatch) return null;
    return searchResults.filter(
      (e) => e.label?.text?.toLowerCase() === q || e.tags?.some((t) => t.toLowerCase() === q)
    ).length;
  }, [query, searchResults, allExpandedEvents]);

  const longTermGoalCounts = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase().trim();
    const hasMatch = allExpandedEvents.some((e) =>
      e.longTermGoals?.some((g) => g.toLowerCase() === q)
    );
    if (!hasMatch) return null;
    return searchResults.filter((e) =>
      e.longTermGoals?.some((g) => g.toLowerCase() === q)
    ).length;
  }, [query, searchResults, allExpandedEvents]);

  const roleMatchCounts = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase().trim();
    const hasMatch = allExpandedEvents.some(
      (e) => e.role && getRoleDisplayName(e.role, language).toLowerCase() === q
    );
    if (!hasMatch) return null;
    return searchResults.filter(
      (e) => e.role && getRoleDisplayName(e.role, language).toLowerCase() === q
    ).length;
  }, [query, searchResults, allExpandedEvents, language, getRoleDisplayName]);

  const roleHighlightDates = useMemo(() => {
    if (!selectedFilterRole) return [];
    return Array.from(
      new Set(
        allExpandedEvents
          .filter((e) => e.role === selectedFilterRole)
          .map((e) => format(new Date(e.startTime), 'yyyy-MM-dd'))
      )
    );
  }, [selectedFilterRole, allExpandedEvents]);

  const searchResultDateCount = useMemo(
    () => (searchResults.length === 0 ? 0 : new Set(searchResults.map((e) => format(new Date(e.startTime), 'yyyy-MM-dd'))).size),
    [searchResults]
  );

  // Drive calendar highlight dates from search results or role filter
  React.useEffect(() => {
    if (!isOpen) return;
    if (!onHighlightsChange) return;

    if (selectedFilterRole) {
      onHighlightsChange(roleHighlightDates);
      return;
    }
    if (!query.trim()) {
      onHighlightsChange([]);
      return;
    }
    const dateKeys = Array.from(
      new Set(searchResults.map((e) => format(new Date(e.startTime), 'yyyy-MM-dd')))
    );
    onHighlightsChange(dateKeys);
  }, [isOpen, query, searchResults, selectedFilterRole, roleHighlightDates, onHighlightsChange]);

  const handleResultClick = (event: ScheduleEvent) => {
    onEventClick(new Date(event.startTime));
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
          >
            <div className="bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[70vh]">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <SearchIcon className="w-5 h-5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={language === 'zh' ? '搜索日程、长期目标、日程标签或角色标签' : 'Search events, long-term goals, event tags or role tags'}
                  className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 text-lg"
                />
                <button onClick={onClose} className="p-2 hover:bg-field rounded-full transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="overflow-y-auto p-2">
                {/* Role filter: search by role tag, same logic as event tag */}
                {onRoleFilterChange && roleOptions.length > 0 && (
                  <div className="px-2 pb-3 flex flex-wrap items-center gap-1.5">
                    {selectedFilterRole && (
                      <button
                        type="button"
                        onClick={() => onRoleFilterChange(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-field text-muted-foreground hover:bg-surface transition-colors flex-shrink-0"
                        title={language === 'zh' ? '清除角色筛选' : 'Clear role filter'}
                      >
                        <FilterX className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {roleOptions.slice(0, 12).map((roleId) => {
                      const isActive = selectedFilterRole === roleId;
                      const color = getRoleColor(roleId);
                      const label = getRoleDisplayName(roleId, language);
                      return (
                        <button
                          key={roleId}
                          type="button"
                          onClick={() => onRoleFilterChange(isActive ? null : roleId)}
                          className={cn(
                            'flex items-center gap-1 pl-1.5 pr-2 h-7 rounded-full text-sm transition-all flex-shrink-0 border',
                            isActive ? 'ring-2 ring-offset-1 ring-offset-background' : 'bg-field hover:bg-surface border-transparent'
                          )}
                          style={isActive ? { backgroundColor: `${color}22`, borderColor: color } : undefined}
                          title={label}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="truncate max-w-[80px]">{label}</span>
                        </button>
                      );
                    })}
                    {selectedFilterRole && onRoleFilterModeChange && (
                      <select
                        value={roleFilterMode}
                        onChange={(e) => onRoleFilterModeChange(e.target.value as 'all' | 'dim' | 'hide')}
                        className="h-7 rounded-full text-xs bg-field border border-border px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="dim">{language === 'zh' ? '弱化其他' : 'Dim others'}</option>
                        <option value="hide">{language === 'zh' ? '仅显示此角色' : 'Show only this role'}</option>
                      </select>
                    )}
                  </div>
                )}

                {!query.trim() && !selectedFilterRole && searchResults.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    {language === 'zh' ? '输入关键词或选择角色筛选' : 'Type to search or select a role to filter'}
                  </div>
                )}
                {((query.trim() || selectedFilterRole) && searchResults.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground">
                    {language === 'zh' ? '未找到结果' : 'No results found'}
                  </div>
                )}

                {tagCounts !== null && (
                  <div className="px-4 py-3 mb-2 bg-accent/20 rounded-xl flex items-center gap-2 text-accent text-sm font-medium">
                    <TagIcon className="w-4 h-4" />
                    {language === 'zh'
                      ? `找到 ${tagCounts} 个带有日程标签 "${query}" 的日程`
                      : `Found ${tagCounts} events with event tag "${query}"`}
                  </div>
                )}
                {longTermGoalCounts !== null && (
                  <div className="px-4 py-3 mb-2 bg-accent/20 rounded-xl flex items-center gap-2 text-accent text-sm font-medium">
                    <TagIcon className="w-4 h-4" />
                    {language === 'zh'
                      ? `找到 ${longTermGoalCounts} 个带有长期目标 "${query}" 的日程`
                      : `Found ${longTermGoalCounts} events with long-term goal "${query}"`}
                  </div>
                )}
                {roleMatchCounts !== null && (
                  <div className="px-4 py-3 mb-2 bg-accent/20 rounded-xl flex items-center gap-2 text-accent text-sm font-medium">
                    <TagIcon className="w-4 h-4" />
                    {language === 'zh'
                      ? `找到 ${roleMatchCounts} 个角色为 "${query}" 的日程`
                      : `Found ${roleMatchCounts} events with role "${query}"`}
                  </div>
                )}

                {(selectedFilterRole || (query.trim() && searchResults.length > 0)) && searchResults.length > 0 && (
                  <div className="px-4 py-2 mb-1 text-xs text-muted-foreground">
                    {selectedFilterRole
                      ? (language === 'zh'
                          ? `共 ${searchResults.length} 个日程（角色：${getRoleDisplayName(selectedFilterRole, language)}）`
                          : `${searchResults.length} events (role: ${getRoleDisplayName(selectedFilterRole, language)})`)
                      : (language === 'zh'
                          ? `共 ${searchResults.length} 个日程，${searchResultDateCount} 天`
                          : `${searchResults.length} events, ${searchResultDateCount} days`)}
                  </div>
                )}

                <div className="space-y-1">
                  {searchResults.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => handleResultClick(event)}
                      className="w-full text-left p-3 hover:bg-field rounded-xl transition-colors flex items-start gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-field flex flex-col items-center justify-center flex-shrink-0 text-muted-foreground group-hover:bg-accent/20 group-hover:text-accent transition-colors">
                        <span className="text-xs font-medium uppercase">
                          {format(new Date(event.startTime), language === 'zh' ? 'M月' : 'MMM', language === 'zh' ? { locale: zhCN } : undefined)}
                        </span>
                        <span className="text-lg font-bold leading-none">{format(new Date(event.startTime), 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <h4 className="text-foreground font-medium truncate">{event.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span>{format(new Date(event.startTime), language === 'zh' ? 'HH:mm' : 'h:mm a')}</span>
                          {event.role && (
                            <>
                              <span>•</span>
                              <span
                                className="inline-flex items-center gap-1"
                                style={{ color: getRoleColor(event.role) }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {getRoleDisplayName(event.role, language)}
                              </span>
                            </>
                          )}
                          {event.label?.text && (
                            <>
                              <span>•</span>
                              <span className="bg-field px-1.5 py-0.5 rounded text-[10px]">{event.label.text}</span>
                            </>
                          )}
                          {event.longTermGoals && event.longTermGoals.length > 0 && (
                            <>
                              <span>•</span>
                              <div className="flex flex-wrap gap-1">
                                {event.longTermGoals.map((g) => (
                                  <span key={g} className="bg-accent/15 text-accent px-1.5 py-0.5 rounded text-[10px]">
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
