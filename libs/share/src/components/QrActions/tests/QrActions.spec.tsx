import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrActions } from '../QrActions';

const {
  mockCreateQrPngBlob,
  mockWriteQrImageToClipboard,
  mockCopyToClipboard,
  mockTriggerBlobDownload,
} = vi.hoisted(() => ({
  mockCreateQrPngBlob: vi.fn(),
  mockWriteQrImageToClipboard: vi.fn(),
  mockCopyToClipboard: vi.fn(),
  mockTriggerBlobDownload: vi.fn(),
}));

/*
 * jsdom has no canvas, so producing and writing the PNG is faked here (both
 * are covered by `qr-image.spec.ts`); the real support check still runs
 * against the stubbed `ClipboardItem` and `navigator.clipboard`.
 */
vi.mock('../../../utils/qr-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/qr-image')>()),
  createQrPngBlob: mockCreateQrPngBlob,
  writeQrImageToClipboard: mockWriteQrImageToClipboard,
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  copyToClipboard: mockCopyToClipboard,
  triggerBlobDownload: mockTriggerBlobDownload,
}));

const URL_VALUE = 'https://example.com/share/abc';
const PNG_BLOB = new Blob(['png'], { type: 'image/png' });

const stubImageClipboard = () => {
  vi.stubGlobal('ClipboardItem', class {});
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write: vi.fn() },
  });
};

const renderActions = (
  overrides: Partial<Parameters<typeof QrActions>[0]> = {},
) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  render(
    <QrActions
      url={URL_VALUE}
      getSvg={() => svg}
      copyLabel="Copy"
      copiedLabel="Copied"
      downloadLabel="Download"
      downloadFileName="share-qr-code.png"
      {...overrides}
    />,
  );
  return { svg };
};

describe('QrActions', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateQrPngBlob.mockResolvedValue(PNG_BLOB);
    mockWriteQrImageToClipboard.mockResolvedValue(undefined);
    mockCopyToClipboard.mockResolvedValue(true);
    user = userEvent.setup({ delay: null });
    /* After `userEvent.setup`, which installs its own clipboard stub. */
    stubImageClipboard();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders Copy and Download buttons', () => {
    renderActions();

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('copies the QR code as an image when the browser supports it', async () => {
    const { svg } = renderActions();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(mockWriteQrImageToClipboard).toHaveBeenCalledOnce();
    expect(mockWriteQrImageToClipboard).toHaveBeenCalledWith(svg);
    expect(mockCopyToClipboard).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('copies the share link as text when image clipboard is unavailable', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(mockWriteQrImageToClipboard).not.toHaveBeenCalled();
    expect(mockCopyToClipboard).toHaveBeenCalledWith(URL_VALUE);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('copies the share link as text when the image write is rejected', async () => {
    mockWriteQrImageToClipboard.mockRejectedValue(new Error('denied'));
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() =>
      expect(mockCopyToClipboard).toHaveBeenCalledWith(URL_VALUE),
    );
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('copies the share link as text when the QR code has not rendered', async () => {
    renderActions({ getSvg: () => null });

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(mockWriteQrImageToClipboard).not.toHaveBeenCalled();
    expect(mockCopyToClipboard).toHaveBeenCalledWith(URL_VALUE);
  });

  it('announces Copied and keeps focus on the Copy button', async () => {
    renderActions();
    const copyButton = screen.getByRole('button', { name: 'Copy' });

    await user.click(copyButton);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Copied'),
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBe(copyButton);
    expect(copyButton.matches(':focus')).toBe(true);
  });

  it('returns to the Copy label once the confirmation delay elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const timedUser = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    stubImageClipboard();
    renderActions();

    await timedUser.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();

    await vi.advanceTimersByTimeAsync(2000);

    expect(await screen.findByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('stays on the Copy label when every copy path fails', async () => {
    mockWriteQrImageToClipboard.mockRejectedValue(new Error('denied'));
    mockCopyToClipboard.mockResolvedValue(false);
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('downloads the QR code as a PNG with the default file name', async () => {
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(
        PNG_BLOB,
        'share-qr-code.png',
      ),
    );
  });

  it('downloads with a host-supplied file name', async () => {
    renderActions({ downloadFileName: 'my-agent-qr.png' });

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(
        PNG_BLOB,
        'my-agent-qr.png',
      ),
    );
  });

  it('downloads nothing when the PNG cannot be produced', async () => {
    mockCreateQrPngBlob.mockRejectedValue(new Error('no canvas'));
    renderActions();

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(mockCreateQrPngBlob).toHaveBeenCalled());
    expect(mockTriggerBlobDownload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });
});
