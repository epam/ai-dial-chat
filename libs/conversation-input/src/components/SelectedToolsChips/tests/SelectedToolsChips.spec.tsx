import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  SelectedToolsChips,
  type SelectedToolsChipsProps,
} from '../SelectedToolsChips';

type ToolMenuItem = SelectedToolsChipsProps['items'][number];

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

const renderChips = (items: ToolMenuItem[], isMobile: boolean) =>
  render(
    <SelectedToolsChips
      items={items}
      onToolToggle={vi.fn()}
      isMobile={isMobile}
      countLabel={(count) => `${count} tools`}
    />,
  );

describe('SelectedToolsChips', () => {
  it('names the single selected tool in the mobile chip', () => {
    renderChips(
      [
        buildTool('deep-research', 'Deep Research', true),
        buildTool('web-search', 'Web Search', false),
      ],
      true,
    );

    expect(screen.getByText('Deep Research')).toBeTruthy();
    expect(screen.queryByText('1 tools')).toBeNull();
  });

  it('collapses two or more selected tools into the count label on mobile', () => {
    renderChips(
      [
        buildTool('deep-research', 'Deep Research', true),
        buildTool('web-search', 'Web Search', true),
      ],
      true,
    );

    expect(screen.getByText('2 tools')).toBeTruthy();
    expect(screen.queryByText('Deep Research')).toBeNull();
  });

  it('renders one chip per selected tool on desktop', () => {
    renderChips(
      [
        buildTool('deep-research', 'Deep Research', true),
        buildTool('web-search', 'Web Search', true),
      ],
      false,
    );

    expect(screen.getByText('Deep Research')).toBeTruthy();
    expect(screen.getByText('Web Search')).toBeTruthy();
  });

  it('renders nothing when no tool is selected', () => {
    const { container } = renderChips(
      [buildTool('deep-research', 'Deep Research', false)],
      true,
    );

    expect(container.firstChild).toBeNull();
  });
});
