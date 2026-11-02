import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarI18nKeys } from '../../../constants/translation-keys';
import SourcesSidebarToggle from '../SourcesSidebarToggle';

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  useAttachmentCanvas: () => ({ closeCanvas: vi.fn() }),
}));
vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ isOpen: false, handleOpen: vi.fn() }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SourcesSidebarToggle />
    </MemoryRouter>,
  );

describe('SourcesSidebarToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    '/conversations/a1b2c3/x',
    '/projects/chat/a1b2c3/q4/conversations/x',
  ])('renders on the conversation page %s', (path) => {
    renderAt(path);

    expect(
      screen.getByRole('button', { name: SidebarI18nKeys.ToggleOpen }),
    ).toBeTruthy();
  });

  it('renders nothing outside a conversation page', () => {
    renderAt('/projects/view/a1b2c3/q4');

    expect(
      screen.queryByRole('button', { name: SidebarI18nKeys.ToggleOpen }),
    ).toBeNull();
  });
});
