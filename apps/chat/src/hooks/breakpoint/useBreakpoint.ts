import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'desktop';

/**
 * Min-width queries ordered from largest to smallest. The first query that
 * matches wins; if none match, the viewport is in the `mobile` band.
 * Keep these aligned with the `screens` map in the root `tailwind.config.js`
 * so JS-driven branches and Tailwind utility prefixes resolve to the same band.
 */
const BREAKPOINT_QUERIES: ReadonlyArray<{
  query: string;
  breakpoint: Breakpoint;
}> = [{ query: '(min-width: 769px)', breakpoint: 'desktop' }];

const resolveBreakpoint = (): Breakpoint => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    // SSR / non-DOM test env: default to desktop so server-rendered markup
    // matches the historical desktop-only baseline.
    return 'desktop';
  }
  for (const { query, breakpoint } of BREAKPOINT_QUERIES) {
    if (window.matchMedia(query).matches) {
      return breakpoint;
    }
  }
  return 'mobile';
};

/**
 * Returns the current named breakpoint, kept in sync with viewport changes.
 *
 * Use only when a component must branch in JS — most responsive layout should
 * use Tailwind's `mobile:` / `desktop:` utility prefixes instead. See
 * `.claude/skills/responsive-design/SKILL.md` for the decision rubric.
 *
 * @example
 * ```tsx
 * const breakpoint = useBreakpoint();
 * if (breakpoint === 'mobile') {
 *   return <ChatDrawer />;
 * }
 * return <ChatSidebar />;
 * ```
 */
export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(resolveBreakpoint);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQueries = BREAKPOINT_QUERIES.map(({ query }) =>
      window.matchMedia(query),
    );

    const handleChange = () => {
      setBreakpoint(resolveBreakpoint());
    };

    mediaQueries.forEach((mql) => mql.addEventListener('change', handleChange));

    return () => {
      mediaQueries.forEach((mql) =>
        mql.removeEventListener('change', handleChange),
      );
    };
  }, []);

  return breakpoint;
};

/**
 * Convenience wrapper for the most common branch: "is this the mobile band?".
 * Prefer Tailwind `mobile:` utility prefixes when only styling differs.
 */
export const useIsMobile = (): boolean => useBreakpoint() === 'mobile';
