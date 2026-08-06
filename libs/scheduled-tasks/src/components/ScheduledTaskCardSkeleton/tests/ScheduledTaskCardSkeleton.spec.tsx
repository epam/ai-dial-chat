import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskCardSkeleton } from '../ScheduledTaskCardSkeleton';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  // Read by @epam/ai-dial-chat-shared at module init, not by the component
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  CardShell: ({
    children,
    ...rest
  }: { children: ReactNode } & Record<string, unknown>) => (
    <article {...rest}>{children}</article>
  ),
  DialSkeleton: ({ color }: { color?: string }) => (
    <div data-skeleton data-color={color} />
  ),
  DialSkeletonVariant: { Default: 'default', Rectangular: 'rectangular' },
}));

describe('ScheduledTaskCardSkeleton', () => {
  it('renders as an aria-hidden card', () => {
    const { container } = render(<ScheduledTaskCardSkeleton />);

    const article = container.querySelector('article');
    expect(article).toBeTruthy();
    expect(article?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a title bar, description lines, and a footer bar as skeleton elements', () => {
    const { container } = render(<ScheduledTaskCardSkeleton />);

    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(5);
  });

  it('reads every skeleton bar color from the --stcs-skeleton-bg variable', () => {
    const { container } = render(<ScheduledTaskCardSkeleton />);

    const bars = container.querySelectorAll('[data-skeleton]');
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach((bar) => {
      expect(bar.getAttribute('data-color')).toBe('var(--stcs-skeleton-bg)');
    });
  });

  it('leaves --stcs-skeleton-bg unset inline so the module fallback applies', () => {
    const { container } = render(<ScheduledTaskCardSkeleton />);

    const article = container.querySelector('article');
    expect(article?.style.getPropertyValue('--stcs-skeleton-bg')).toBe('');
  });

  it('sets --stcs-skeleton-bg from the caller-supplied skeletonColor override', () => {
    const { container } = render(
      <ScheduledTaskCardSkeleton
        styles={{ colors: { skeletonColor: '#ff00ff' } }}
      />,
    );

    const article = container.querySelector('article');
    expect(article?.style.getPropertyValue('--stcs-skeleton-bg')).toBe(
      '#ff00ff',
    );
  });
});
