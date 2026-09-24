import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { UserConfigStatus } from '../../../types/user-config-status';
import { usePdfPreviewLoader } from '../usePdfPreviewLoader';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
const fetchMock = vi.fn();

function setOrigins(origins: string[]) {
  vi.mocked(useAppConfig).mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: { allowedConnectOrigins: origins } as never,
  });
}

describe('usePdfPreviewLoader', () => {
  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockResolvedValue({ ok: true, blob: async () => pdf });
    vi.stubGlobal('fetch', fetchMock);
    setOrigins([
      'https://documents.example.com',
      'https://*.reports.example.org:8443',
    ]);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    'https://documents.example.com/report.pdf',
    'https://one.reports.example.org:8443/report.pdf',
    'https://one.two.reports.example.org:8443/report.pdf',
  ])(
    'loads an allowed PDF with cookies without following redirects: %s',
    async (url) => {
      const { result } = renderHook(() => usePdfPreviewLoader());
      expect(await result.current(url)).toBe(pdf);
      expect(fetchMock).toHaveBeenCalledWith(url, {
        credentials: 'include',
        redirect: 'error',
      });
    },
  );

  it.each([
    'https://other.example.com/report.pdf',
    'https://documents.example.com.attacker.test/report.pdf',
    'https://sub.documents.example.com/report.pdf',
    'http://documents.example.com/report.pdf',
    'https://documents.example.com:8443/report.pdf',
    'https://reports.example.org:8443/report.pdf',
    'https://one.reports.example.org/report.pdf',
    '/api/v1/files/download?path=report.pdf',
    'blob:https://documents.example.com/uuid',
  ])('keeps default cookie scope for %s', async (url) => {
    const { result } = renderHook(() => usePdfPreviewLoader());
    expect(await result.current(url)).toBe(pdf);
    expect(fetchMock).toHaveBeenCalledWith(url, { credentials: 'same-origin' });
  });

  it.each([
    { origins: [] },
    { origins: ['https://documents.example.com:99999'] },
  ])(
    'does not opt in for an empty or unusable allowlist $origins',
    async ({ origins }) => {
      setOrigins(origins);
      const { result } = renderHook(() => usePdfPreviewLoader());
      await result.current('https://documents.example.com/report.pdf');
      expect(fetchMock.mock.calls[0][1]).toEqual({
        credentials: 'same-origin',
      });
    },
  );

  it('matches normalized origins and updates when configuration changes', async () => {
    setOrigins(['https://DOCUMENTS.example.com:443']);
    const { result, rerender } = renderHook(() => usePdfPreviewLoader());
    const url = 'https://documents.example.com/report.pdf';
    await result.current(url);
    expect(fetchMock.mock.lastCall?.[1].credentials).toBe('include');
    setOrigins([]);
    rerender();
    await result.current(url);
    expect(fetchMock.mock.lastCall?.[1].credentials).toBe('same-origin');
  });

  it('matches wildcard patterns when the browser percent-encodes asterisks in URL origins', async () => {
    const NativeURL = URL;
    /*
     * Simulate browser origin serialization: passing a raw wildcard to URL
     * would encode it as %2A and prevent the allowlist matcher from recognizing it.
     */
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        override get origin() {
          return super.origin.replaceAll('*', '%2A');
        }
      },
    );
    setOrigins(['https://*.REPORTS.example.org:443']);
    const { result } = renderHook(() => usePdfPreviewLoader());
    const url = 'https://one.reports.example.org/report.pdf';

    expect(await result.current(url)).toBe(pdf);
    expect(fetchMock).toHaveBeenCalledWith(url, {
      credentials: 'include',
      redirect: 'error',
    });
  });

  it('preserves same-origin requests even if the app origin is allowlisted', async () => {
    setOrigins([window.location.origin]);
    const { result } = renderHook(() => usePdfPreviewLoader());
    await result.current('/api/v1/files/download?path=report.pdf');
    expect(fetchMock.mock.lastCall?.[1]).toEqual({
      credentials: 'same-origin',
    });
  });

  it('surfaces an HTTP failure without reading its body as a PDF', async () => {
    const blob = vi.fn();
    fetchMock.mockResolvedValue({ ok: false, status: 403, blob });
    const { result } = renderHook(() => usePdfPreviewLoader());
    await expect(
      result.current('https://documents.example.com/report.pdf'),
    ).rejects.toThrow('HTTP 403');
    expect(blob).not.toHaveBeenCalled();
  });

  it('propagates a blocked redirect without retrying with broader permissions', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => usePdfPreviewLoader());
    await expect(
      result.current('https://documents.example.com/report.pdf'),
    ).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
