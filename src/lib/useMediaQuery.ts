import { useEffect, useState } from 'react';

/** Tailwind `md` breakpoint — desktop layout helpers. */
export function useMediaQueryMdUp(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
