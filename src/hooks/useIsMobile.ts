import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport width is at or below the given breakpoint (default 1280px).
 * Reacts to window resize and orientation change via matchMedia.
 */
export function useIsMobile(breakpoint = 1280): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
