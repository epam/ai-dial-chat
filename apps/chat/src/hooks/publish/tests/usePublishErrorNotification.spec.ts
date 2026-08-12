import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { usePublishErrorNotification } from '../usePublishErrorNotification';

vi.mock('../../../context/NotificationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockShowNotification = vi.fn();

const setOnLine = (isOnLine: boolean) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnLine);
};

/** Shapes an error the way the generated API client does, so `getApiErrorDetails` can read it. */
const apiError = (body: unknown, status = 500) => ({
  response: {
    status,
    clone: () => ({ json: async () => body }),
    json: async () => body,
    headers: { get: () => null },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  setOnLine(true);
  vi.mocked(useNotification).mockReturnValue({
    notifications: [],
    showNotification: mockShowNotification,
    dismissNotification: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePublishErrorNotification', () => {
  it('shows a connection-specific error notification without a request ID while offline', async () => {
    setOnLine(false);
    const { result } = renderHook(() => usePublishErrorNotification());

    result.current(new TypeError('Failed to fetch'));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        title: 'publish.failedTitle',
        message: 'publish.networkErrorMessage',
      }),
    );
  });

  it('shows the server-provided error message with the trace ID for a backend error', async () => {
    const { result } = renderHook(() => usePublishErrorNotification());

    result.current(
      apiError({
        message: 'Upstream rejected the request',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    );

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        title: 'publish.failedTitle',
        message: 'Upstream rejected the request',
        requestId: '4bf92f3577b34da6a3ce929d0e0e4736',
      }),
    );
  });

  it('falls back to the generic message when the error carries no server message', async () => {
    const { result } = renderHook(() => usePublishErrorNotification());

    result.current({});

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        title: 'publish.failedTitle',
        message: 'publish.failedMessage',
        requestId: undefined,
      }),
    );
  });

  it('shows the notification without a request ID when the error carries no trace ID', async () => {
    const { result } = renderHook(() => usePublishErrorNotification());

    result.current(new Error('boom'));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        title: 'publish.failedTitle',
        message: 'boom',
        requestId: undefined,
      }),
    );
  });

  it('logs the underlying error for diagnostics', async () => {
    const { result } = renderHook(() => usePublishErrorNotification());
    const error = new Error('boom');

    result.current(error);

    expect(console.error).toHaveBeenCalledWith('Publish request failed', error);
  });
});
