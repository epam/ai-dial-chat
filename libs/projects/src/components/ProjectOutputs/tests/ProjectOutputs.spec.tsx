import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectOutputItem,
  ProjectOutputsProps,
} from '../../../models/project-outputs-props';
import { ProjectOutputs } from '../ProjectOutputs';

const itemsOf = (count: number): ProjectOutputItem[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `report-${index + 1}.pdf`,
    contentType: 'application/pdf',
  }));

const renderOutputs = (props: Partial<ProjectOutputsProps> = {}) => {
  const onOpenOutput = vi.fn();
  const view = render(
    <ProjectOutputs
      items={itemsOf(2)}
      onOpenOutput={onOpenOutput}
      {...props}
    />,
  );
  return { ...view, onOpenOutput };
};

const cards = () =>
  within(screen.getByRole('list')).getAllByRole('button', {
    name: /^Preview /,
  });

describe('ProjectOutputs', () => {
  it('renders only an empty live region when there are no outputs', () => {
    renderOutputs({ items: [] });

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('renders a section named by its Outputs heading', () => {
    renderOutputs();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Outputs' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Outputs' })).toBeTruthy();
    expect(cards()).toHaveLength(2);
  });

  it('shows the preview limit and a collapsed See all when more outputs exist', () => {
    renderOutputs({ items: itemsOf(9) });

    expect(cards()).toHaveLength(6);
    const seeAll = screen.getByRole('button', { name: 'See all (9)' });
    expect(seeAll.getAttribute('aria-expanded')).toBe('false');
    expect(seeAll.getAttribute('aria-controls')).toBe(
      screen.getByRole('list').id,
    );
  });

  it('expands every output in place and collapses again', async () => {
    renderOutputs({ items: itemsOf(9) });

    await userEvent.click(screen.getByRole('button', { name: 'See all (9)' }));

    expect(cards()).toHaveLength(9);
    const showLess = screen.getByRole('button', { name: 'Show less' });
    expect(showLess.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(showLess);

    expect(cards()).toHaveLength(6);
    // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'See all (9)' }),
    );
  });

  it('keeps the expanded state when the outputs change', async () => {
    const { rerender, onOpenOutput } = renderOutputs({ items: itemsOf(9) });
    await userEvent.click(screen.getByRole('button', { name: 'See all (9)' }));

    rerender(
      <ProjectOutputs items={itemsOf(10)} onOpenOutput={onOpenOutput} />,
    );

    expect(cards()).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
  });

  it('honours a custom preview limit', () => {
    renderOutputs({ items: itemsOf(4), previewLimit: 3 });

    expect(cards()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'See all (4)' })).toBeTruthy();
  });

  it('offers no See all when every output fits', () => {
    renderOutputs({ items: itemsOf(4) });

    expect(cards()).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /See all/ })).toBeNull();
  });

  it('calls onOpenOutput with the file name when a card is activated', async () => {
    const { onOpenOutput } = renderOutputs();

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview report-2.pdf' }),
    );

    expect(onOpenOutput).toHaveBeenCalledWith('report-2.pdf');
  });

  it('offers no rename, delete or upload action', () => {
    renderOutputs();

    expect(
      screen.queryByRole('button', { name: /rename|delete|remove|upload/i }),
    ).toBeNull();
  });

  it('announces a failure through the live region that was mounted before it', () => {
    const { rerender } = renderOutputs({ items: [] });
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');

    rerender(
      <ProjectOutputs
        items={[]}
        hasError
        onRetry={vi.fn()}
        onOpenOutput={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('Could not load outputs');
    expect(screen.getByRole('heading', { name: 'Outputs' })).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('calls onRetry from the retry action of the error state', async () => {
    const onRetry = vi.fn();
    renderOutputs({ items: [], hasError: true, onRetry });

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('moves focus to the heading when a retry brings the outputs', async () => {
    const onOpenOutput = vi.fn();
    const { rerender } = render(
      <ProjectOutputs
        items={[]}
        hasError
        onRetry={vi.fn()}
        onOpenOutput={onOpenOutput}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    rerender(<ProjectOutputs items={itemsOf(2)} onOpenOutput={onOpenOutput} />);

    expect(screen.getByRole('heading', { name: 'Outputs' })).toHaveProperty(
      'tabIndex',
      -1,
    );
    // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Outputs' }),
    );
  });

  it('does not move focus when the outputs change without a retry', () => {
    const onOpenOutput = vi.fn();
    const { rerender } = render(
      <ProjectOutputs items={itemsOf(1)} onOpenOutput={onOpenOutput} />,
    );

    rerender(<ProjectOutputs items={itemsOf(2)} onOpenOutput={onOpenOutput} />);

    // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
    expect(document.activeElement).toBe(document.body);
  });

  it('applies the host labels', () => {
    renderOutputs({
      items: itemsOf(7),
      labels: {
        title: 'Ergebnisse',
        seeAllLabel: (count) => `Alle ${count}`,
        openOutputLabel: (name) => `Öffnen ${name}`,
      },
    });

    expect(screen.getByRole('heading', { name: 'Ergebnisse' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Alle 7' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Öffnen report-1.pdf' }),
    ).toBeTruthy();
  });

  it('scrolls the collapsed row inside its column and wraps once expanded', async () => {
    renderOutputs({ items: itemsOf(9) });
    const list = screen.getByRole('list');

    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).toContain('flex-nowrap');
    expect(list.className).toContain('min-w-0');

    await userEvent.click(screen.getByRole('button', { name: 'See all (9)' }));

    expect(screen.getByRole('list').className).toContain('flex-wrap');
  });

  it('uses only logical direction classes under RTL', () => {
    const { container } = render(
      <div dir="rtl">
        <ProjectOutputs items={itemsOf(9)} onOpenOutput={vi.fn()} />
      </div>,
    );

    /* The class names are the assertion; no role query reaches them. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const classNames = Array.from(container.querySelectorAll('[class]'))
      .map((element) => element.getAttribute('class') ?? '')
      .join(' ');
    expect(classNames).not.toMatch(
      /(^|\s)(ml|mr|pl|pr|left|right)-|text-(left|right)(\s|$)/,
    );
  });
});
