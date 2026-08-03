import { render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskCardSkeleton } from '../ScheduledTaskCardSkeleton';

vi.mock('@epam/ai-dial-ui-kit', () => ({
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

  it('defaults every skeleton bar to var(--bg-layer-4) when no color override is given', () => {
    const { container } = render(<ScheduledTaskCardSkeleton />);

    const bars = container.querySelectorAll('[data-skeleton]');
    bars.forEach((bar) => {
      expect(bar.getAttribute('data-color')).toBe('var(--bg-layer-4)');
    });
  });

  it('uses the caller-supplied skeletonColor override for every bar', () => {
    const { container } = render(
      <ScheduledTaskCardSkeleton
        styles={{ colors: { skeletonColor: '#ff00ff' } }}
      />,
    );

    const bars = container.querySelectorAll('[data-skeleton]');
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach((bar) => {
      expect(bar.getAttribute('data-color')).toBe('#ff00ff');
    });
  });
});
