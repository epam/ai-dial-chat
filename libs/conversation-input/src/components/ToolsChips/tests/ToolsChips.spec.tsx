import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolsChips, type ToolsChipsProps } from '../ToolsChips';

type ToolMenuItem = ToolsChipsProps['items'][number];

const buildTool = (
  id: string,
  label: string,
  isSelected: boolean,
): ToolMenuItem => ({
  id,
  label,
  icon: <span />,
  isSelected,
});

const renderChips = (items: ToolMenuItem[], props?: Partial<ToolsChipsProps>) =>
  render(
    <ToolsChips
      items={items}
      onToolToggle={vi.fn()}
      onToolDismiss={vi.fn()}
      {...props}
    />,
  );

describe('ToolsChips', () => {
  it('renders a chip for every tool it is given, selected or not', () => {
    renderChips([
      buildTool('deep-research', 'Deep Research', true),
      buildTool('web-search', 'Web Search', false),
    ]);

    expect(screen.getByRole('button', { name: 'Deep Research' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Web Search' })).toBeTruthy();
  });

  it('exposes the on/off state through aria-pressed', () => {
    renderChips([
      buildTool('deep-research', 'Deep Research', true),
      buildTool('web-search', 'Web Search', false),
    ]);

    expect(
      screen
        .getByRole('button', { name: 'Deep Research' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Web Search' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('toggles the clicked tool by id', async () => {
    const onToolToggle = vi.fn();
    renderChips([buildTool('web-search', 'Web Search', false)], {
      onToolToggle,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Web Search' }));

    expect(onToolToggle).toHaveBeenCalledWith('web-search');
  });

  it('dismisses the tool when its × is clicked, without toggling it', async () => {
    const onToolToggle = vi.fn();
    const onToolDismiss = vi.fn();
    renderChips([buildTool('web-search', 'Web Search', false)], {
      onToolToggle,
      onToolDismiss,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Web Search' }),
    );

    expect(onToolDismiss).toHaveBeenCalledWith('web-search');
    expect(onToolToggle).not.toHaveBeenCalled();
  });

  it('labels the × button through the removeLabel prop', () => {
    renderChips([buildTool('web-search', 'Web Search', false)], {
      removeLabel: (label) => `Drop ${label}`,
    });

    expect(
      screen.getByRole('button', { name: 'Drop Web Search' }),
    ).toBeTruthy();
  });

  it('renders nothing when there are no tools to show', () => {
    const { container } = renderChips([]);

    expect(container.innerHTML).toBe('');
  });
});
