import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useUiFeatureModule from '../../../hooks/useUiFeature';
import ChatLayout from '../ChatLayout';

vi.mock('../../../hooks/useUiFeature');
vi.mock('../../Header/SourcesSidebarToggle', () => ({
  default: () => <div />,
}));
vi.mock('../../Header/Logo', () => ({
  default: () => <a href="/" aria-label="Logo" />,
}));

const renderChatLayout = () =>
  render(
    <MemoryRouter initialEntries={['/conversations/test']}>
      <Routes>
        <Route path="*" element={<ChatLayout />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ChatLayout', () => {
  const mockUseUiFeature = vi.mocked(useUiFeatureModule.useUiFeature);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUiFeature.mockReturnValue(true);
  });

  it('renders the logo in the top bar when show-header-logo is enabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature === OverlayFeature.ShowHeaderLogo,
    );
    renderChatLayout();

    expect(screen.getByRole('link', { name: 'Logo' })).toBeTruthy();
  });

  it('omits the logo when show-header-logo is disabled', () => {
    mockUseUiFeature.mockImplementation(
      (feature) => feature !== OverlayFeature.ShowHeaderLogo,
    );
    renderChatLayout();

    expect(screen.queryByRole('link', { name: 'Logo' })).toBeNull();
  });

  it('renders no panel toggle or new-chat button, which live in the sidebar', () => {
    renderChatLayout();

    expect(screen.queryByRole('button')).toBeNull();
  });
});
