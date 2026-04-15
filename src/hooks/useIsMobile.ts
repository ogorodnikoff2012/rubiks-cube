import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport matches either condition:
 * - width ≤ breakpoint (default 1280px)
 * - aspect ratio ≤ aspectRatio (default 1/1, i.e. portrait or square)
 * Reacts to viewport changes via matchMedia.
 */
export function useIsMobile(breakpoint = 1280, aspectRatio = '1/1'): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px), (max-aspect-ratio: ${aspectRatio})`)
      .matches;
  });

  useEffect(() => {
    const query = `(max-width: ${breakpoint}px), (max-aspect-ratio: ${aspectRatio})`;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint, aspectRatio]);

  return isMobile;
}
