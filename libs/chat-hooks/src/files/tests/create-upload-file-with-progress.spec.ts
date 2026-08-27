import type { FileUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUploadFileWithProgress } from '../create-upload-file-with-progress';

type XhrListener = (event?: ProgressEvent<EventTarget>) => void;

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  uploadListeners: XhrListener[] = [];
  upload = {
    addEventListener: (_type: string, listener: XhrListener) => {
      this.uploadListeners.push(listener);
    },
  };
  withCredentials = false;
  status = 200;
  responseText = JSON.stringify({ url: 'files/bucket/report.pdf' });

  private listeners = new Map<string, XhrListener[]>();
  private responseHeaders = new Map<string, string>();

  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    this.triggerUploadProgress(50);
    this.triggerUploadProgress(100);
    this.trigger('load');
  });
  abort = vi.fn(() => this.trigger('abort'));
  getResponseHeader = vi.fn(
    (name: string) => this.responseHeaders.get(name.toLowerCase()) ?? null,
  );

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  addEventListener(type: string, listener: XhrListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  setMockResponseHeader(name: string, value: string) {
    this.responseHeaders.set(name.toLowerCase(), value);
  }

  private trigger(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  private triggerUploadProgress(loaded: number) {
    const total = 100;
    for (const listener of this.uploadListeners) {
      listener({
        lengthComputable: true,
        loaded,
        total,
      } as ProgressEvent<EventTarget>);
    }
  }
}

class UnauthorizedTestError extends Error {
  constructor(public readonly url: string) {
    super(`Unauthorized: ${url}`);
  }
}

const makeUploader = (
  overrides: Partial<{
    getCsrfToken: () => string | null;
    setCsrfToken: (token: string | null) => void;
    notifyUnauthorized: (url: string) => void;
  }> = {},
  xhrFactory?: () => XMLHttpRequest,
) =>
  createUploadFileWithProgress({
    getCsrfToken: overrides.getCsrfToken ?? (() => null),
    setCsrfToken: overrides.setCsrfToken ?? vi.fn(),
    notifyUnauthorized: overrides.notifyUnauthorized ?? vi.fn(),
    createUnauthorizedError: (url) => new UnauthorizedTestError(url),
    uploadUrl: '/api/v1/files',
    xhrFactory,
  });

describe('createUploadFileWithProgress', () => {
  afterEach(() => {
    MockXMLHttpRequest.instances = [];
    vi.unstubAllGlobals();
  });

  it('reports upload progress and resolves JSON response', async () => {
    vi.stubGlobal(
      'XMLHttpRequest',
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest,
    );

    const progress: number[] = [];
    const upload = makeUploader();
    const result = await upload(
      'bucket',
      'report.pdf',
      new File(['data'], 'report.pdf'),
      {
        onProgress: (percent) => progress.push(percent),
      },
    );

    expect(result).toEqual({
      url: 'files/bucket/report.pdf',
    } satisfies FileUploadResponseDto);
    expect(progress).toEqual([50, 100]);
    expect(MockXMLHttpRequest.instances[0]?.withCredentials).toBe(true);
  });

  it('uses the injected xhrFactory instead of the global constructor', async () => {
    const mock = new MockXMLHttpRequest();
    const xhrFactory = vi.fn(() => mock as unknown as XMLHttpRequest);
    const upload = makeUploader({}, xhrFactory);

    await upload('bucket', 'report.pdf', new File(['data'], 'report.pdf'), {});

    expect(xhrFactory).toHaveBeenCalledOnce();
    expect(mock.send).toHaveBeenCalled();
  });

  it('attaches the current CSRF token and captures a rotated one', async () => {
    const mock = new MockXMLHttpRequest();
    mock.setMockResponseHeader('x-csrf-token', 'rotated-token');
    const setCsrfToken = vi.fn();
    const upload = makeUploader(
      { getCsrfToken: () => 'current-token', setCsrfToken },
      () => mock as unknown as XMLHttpRequest,
    );

    await upload('bucket', 'report.pdf', new File(['data'], 'report.pdf'), {});

    expect(mock.setRequestHeader).toHaveBeenCalledWith(
      'X-CSRF-Token',
      'current-token',
    );
    expect(setCsrfToken).toHaveBeenCalledWith('rotated-token');
  });

  it('rejects with the injected unauthorized error on a 401 response', async () => {
    const mock = new MockXMLHttpRequest();
    mock.status = 401;
    const notifyUnauthorized = vi.fn();
    const upload = makeUploader(
      { notifyUnauthorized },
      () => mock as unknown as XMLHttpRequest,
    );

    await expect(
      upload('bucket', 'report.pdf', new File(['data'], 'report.pdf'), {}),
    ).rejects.toBeInstanceOf(UnauthorizedTestError);
    expect(notifyUnauthorized).toHaveBeenCalledWith('/api/v1/files');
  });
});
