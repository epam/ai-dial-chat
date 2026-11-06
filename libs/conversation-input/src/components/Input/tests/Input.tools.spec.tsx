import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

const { mockUseIsMobile, mockUseIsPhone } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
  mockUseIsPhone: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    useIsMobile: mockUseIsMobile,
    useIsPhone: mockUseIsPhone,
  };
});

const buildTool = (
  id: string,
  label: string,
  isSelected = false,
): ToolMenuItem => ({ id, label, icon: null, isSelected });

const renderInput = (toolsMenuItems: ToolMenuItem[], onToolToggle = vi.fn()) =>
  render(
    <Input
      onSend={vi.fn()}
      toolsMenuItems={toolsMenuItems}
      onToolToggle={onToolToggle}
    />,
  );

describe('Input — tool chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    mockUseIsPhone.mockReturnValue(false);
  });

  it('renders a chip for every tool the deployment exposes', () => {
    renderInput([
      buildTool('deep_research', 'Deep Research'),
      buildTool('web_search', 'Web Search'),
    ]);

    expect(screen.getByRole('button', { name: 'Deep Research' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Web Search' })).toBeTruthy();
  });

  it('drops the chip from the input when its × is clicked', async () => {
    renderInput([buildTool('web_search', 'Web Search')]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Web Search' }),
    );

    expect(screen.queryByRole('button', { name: 'Web Search' })).toBeNull();
  });

  it('turns a selected tool off when it is dropped from the input', async () => {
    const onToolToggle = vi.fn();
    renderInput([buildTool('web_search', 'Web Search', true)], onToolToggle);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Web Search' }),
    );

    expect(onToolToggle).toHaveBeenCalledWith('web_search');
  });

  it('brings a dropped chip back when the tool is switched on again', async () => {
    const tools = [buildTool('web_search', 'Web Search')];
    const { rerender } = renderInput(tools);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Web Search' }),
    );
    expect(screen.queryByRole('button', { name: 'Web Search' })).toBeNull();

    rerender(
      <Input
        onSend={vi.fn()}
        toolsMenuItems={[buildTool('web_search', 'Web Search', true)]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Web Search' })).toBeTruthy();
  });

  it('forgets dropped chips when the deployment offers a different tool list', async () => {
    const { rerender } = renderInput([buildTool('web_search', 'Web Search')]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Web Search' }),
    );
    expect(screen.queryByRole('button', { name: 'Web Search' })).toBeNull();

    rerender(
      <Input
        onSend={vi.fn()}
        toolsMenuItems={[
          buildTool('web_search', 'Web Search'),
          buildTool('deep_research', 'Deep Research'),
        ]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Web Search' })).toBeTruthy();
  });
});

describe('Input — tool chips with canRemoveTools off', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    mockUseIsPhone.mockReturnValue(false);
  });

  it('renders every chip without a × control', () => {
    render(
      <Input
        onSend={vi.fn()}
        canRemoveTools={false}
        toolsMenuItems={[buildTool('deep_research', 'Deep Research')]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deep Research' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Remove Deep Research' }),
    ).toBeNull();
  });

  it('drops the + button when tools are the only thing its menu would offer', () => {
    render(
      <Input
        onSend={vi.fn()}
        hideAttachFile
        canRemoveTools={false}
        toolsMenuItems={[buildTool('deep_research', 'Deep Research')]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Deep Research' })).toBeTruthy();
  });

  it('keeps the + button when the menu still has other entries', () => {
    render(
      <Input
        onSend={vi.fn()}
        canRemoveTools={false}
        toolsMenuItems={[buildTool('deep_research', 'Deep Research')]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });
});

describe('Input — tool chips on a phone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(true);
    mockUseIsPhone.mockReturnValue(true);
  });

  it('hides the chip of a tool that is switched off', () => {
    renderInput([buildTool('deep_research', 'Deep Research')]);

    expect(screen.queryByRole('button', { name: 'Deep Research' })).toBeNull();
  });

  it('hides the chip of a tool that is switched on', () => {
    renderInput([buildTool('deep_research', 'Deep Research', true)]);

    expect(screen.queryByRole('button', { name: 'Deep Research' })).toBeNull();
  });

  it('keeps the + button for tools even when chips are not removable', () => {
    render(
      <Input
        onSend={vi.fn()}
        hideAttachFile
        canRemoveTools={false}
        toolsMenuItems={[buildTool('deep_research', 'Deep Research')]}
        onToolToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });
});
