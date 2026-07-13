import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../../context/auth/UserContext';
import * as ThemeContextModule from '../../../context/ThemeContext';
import { AppsEditorEvent } from '../../../types/apps-editor';
import { AuthStatus } from '../../../types/auth-status';
import AppEditorIframe from '../AppEditorIframe';

vi.mock('../../../context/auth/UserContext');
vi.mock('../../../context/ThemeContext');

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialSpinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="status" aria-label={ariaLabel ?? 'Loading'} />
  ),
}));

const mockUseUser = vi.mocked(UserContextModule.useUser);
const mockUseTheme = vi.mocked(ThemeContextModule.useTheme);

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

const DEFAULT_PROPS = {
  schema: SCHEMA,
  appId: 'abc',
  onUpdated: vi.fn(),
};

const renderIframe = (props?: Partial<typeof DEFAULT_PROPS>) =>
  render(<AppEditorIframe {...DEFAULT_PROPS} {...props} />);

describe('AppEditorIframe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { sub: 'u1', providerId: 'local', claims: {}, isAdmin: false },
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      currentTheme: 'dark',
      selectedTheme: 'dark',
      setTheme: vi.fn(),
      isLoading: false,
    });
  });

  it('builds iframe src with correct auth params', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp') as HTMLIFrameElement;
    const url = new URL(iframe.src);
    expect(url.searchParams.get('authProvider')).toBe('local');
    expect(url.searchParams.get('id')).toBe('abc');
    expect(url.searchParams.get('theme')).toBe('dark');
  });

  it('shows spinner on mount', () => {
    renderIframe();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('hides spinner after iframe load event', () => {
    renderIframe();
    const iframe = screen.getByTitle('QuickApp');
    fireEvent.load(iframe);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides spinner after readyToInteract postMessage', () => {
    renderIframe();
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('calls onUpdated when updatedApplicationSuccess message arrives', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.UpdatedSuccess}`,
        },
        origin: 'https://editor.example.com',
      }),
    );
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('ignores messages from a different origin', () => {
    const onUpdated = vi.fn();
    renderIframe({ onUpdated });
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: `${SCHEMA.displayName}/${AppsEditorEvent.ReadyToInteract}`,
        },
        origin: 'https://evil.example.com',
      }),
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('removes message listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderIframe();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });
});
