import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../../constants/translation-keys';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import ChatLayout from '../ChatLayout';

vi.mock('../../../hooks/useUiFeature');
vi.mock('../../Header/SourcesSidebarToggle', () => ({
  default: () => <div />,
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
    className,
  }: {
    'aria-label': string;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
    />
  ),
}));

const renderChatLayout = (props?: Partial<ComponentProps<typeof ChatLayout>>) =>
  render(
    <MemoryRouter initialEntries={['/conversations/test']}>
      <Routes>
        <Route
          path="*"
          element={
            <ChatLayout
              isPanelOpen={false}
              onTogglePanel={vi.fn()}
              onNewChat={vi.fn()}
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ChatLayout', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUiFeature.mockImplementation(
      (feature) =>
        feature !== OverlayFeature.HideNewConversation &&
        feature !== OverlayFeature.ChatHeaderBorder,
    );
  });

  it('renders the conversations-panel-toggle button by default', () => {
    renderChatLayout();
    expect(
      screen.getByRole('button', {
        name: ConversationPanelI18nKeys.ToggleAriaLabel,
      }),
    ).toBeTruthy();
  });

  it('hides the conversations-panel-toggle button when disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsPanelToggle,
    );
    renderChatLayout();
    expect(
      screen.queryByRole('button', {
        name: ConversationPanelI18nKeys.ToggleAriaLabel,
      }),
    ).toBeNull();
  });

  it('renders the new-conversation button when the panel is closed', () => {
    renderChatLayout({ isPanelOpen: false });
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.NewChat }),
    ).toBeTruthy();
  });

  it('hides the new-conversation button when hide-new-conversation is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.HideNewConversation,
    );
    renderChatLayout({ isPanelOpen: false });
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.NewChat }),
    ).toBeNull();
  });

  it('does not apply a bottom border by default', () => {
    const { container } = renderChatLayout();
    const bar = container.querySelector('.desktop\\:flex');
    expect(bar?.className).not.toContain('border-b');
  });

  it('applies a bottom border when chat-header-border is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.ChatHeaderBorder,
    );
    const { container } = renderChatLayout();
    const bar = container.querySelector('.desktop\\:flex');
    expect(bar?.className).toContain('border-b');
  });
});
