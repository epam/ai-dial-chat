import type { FileUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import { FileUploadFailureReason } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UploadBodyEncoding,
  createUploadFileWithProgress,
} from '../create-upload-file-with-progress';
import { resolveUploadFailureReason } from '../dial-file-manager-mapping.util';

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
  bodyEncoding?: UploadBodyEncoding,
) =>
  createUploadFileWithProgress({
    getCsrfToken: overrides.getCsrfToken ?? (() => null),
    setCsrfToken: overrides.setCsrfToken ?? vi.fn(),
    notifyUnauthorized: overrides.notifyUnauthorized ?? vi.fn(),
    createUnauthorizedError: (url) => new UnauthorizedTestError(url),
    uploadUrl: '/api/v1/files',
    bodyEncoding,
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

  it('rejects a failed response with an error that keeps its status, so the reason resolves', async () => {
    const mock = new MockXMLHttpRequest();
    mock.status = 409;
    mock.responseText = JSON.stringify({
      statusCode: 409,
      message: 'File already exists at this path',
    });
    const upload = makeUploader({}, () => mock as unknown as XMLHttpRequest);

    const error = await upload(
      'bucket',
      'report.pdf',
      new File(['data'], 'report.pdf'),
      {},
    ).catch((rejection: unknown) => rejection);

    await expect(resolveUploadFailureReason(error)).resolves.toBe(
      FileUploadFailureReason.Conflict,
    );
  });

  it('resolves a request that got no response as a network failure', async () => {
    const mock = new MockXMLHttpRequest();
    const triggerable = mock as unknown as { trigger: (type: string) => void };
    mock.send = vi.fn(() => triggerable.trigger('error'));
    const upload = makeUploader({}, () => mock as unknown as XMLHttpRequest);

    const error = await upload(
      'bucket',
      'report.pdf',
      new File(['data'], 'report.pdf'),
      {},
    ).catch((rejection: unknown) => rejection);

    await expect(resolveUploadFailureReason(error)).resolves.toBe(
      FileUploadFailureReason.Network,
    );
  });

  it('sends a multipart POST with the file and fields by default', async () => {
    const mock = new MockXMLHttpRequest();
    const file = new File(['data'], 'q3.csv', { type: 'text/csv' });
    const upload = makeUploader({}, () => mock as unknown as XMLHttpRequest);

    await upload('Abc123', 'reports/q3.csv', file, {
      uploadMode: 'create-only',
    });

    expect(mock.open).toHaveBeenCalledWith('POST', '/api/v1/files');
    const [[body]] = mock.send.mock.calls as unknown as [[unknown]];
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
    expect(formData.get('bucket')).toBe('Abc123');
    expect(formData.get('path')).toBe('reports/q3.csv');
    expect(formData.get('uploadMode')).toBe('create-only');
    expect(formData.has('contentType')).toBe(false);
  });

  describe('createUploadFileWithProgress — raw encoding', () => {
    const makeRawUploader = (
      mock: MockXMLHttpRequest,
      overrides: Parameters<typeof makeUploader>[0] = {},
    ) =>
      makeUploader(
        overrides,
        () => mock as unknown as XMLHttpRequest,
        UploadBodyEncoding.Raw,
      );

    it('sends a PUT with the fields in the query and the File as the body', async () => {
      const mock = new MockXMLHttpRequest();
      const file = new File(['data'], 'q3.csv', { type: 'text/csv' });

      await makeRawUploader(mock)('Abc123', 'reports/q3.csv', file, {
        uploadMode: 'create-only',
      });

      expect(mock.open).toHaveBeenCalledWith(
        'PUT',
        '/api/v1/files?bucket=Abc123&path=reports%2Fq3.csv&uploadMode=create-only&contentType=text%2Fcsv',
      );
      expect(mock.setRequestHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
      expect(mock.send).toHaveBeenCalledWith(file);
    });

    it('omits contentType and uploadMode when they are not set', async () => {
      const mock = new MockXMLHttpRequest();

      await makeRawUploader(mock)(
        'Abc123',
        'blob.bin',
        new File(['data'], 'blob.bin'),
        {},
      );

      expect(mock.open).toHaveBeenCalledWith(
        'PUT',
        '/api/v1/files?bucket=Abc123&path=blob.bin',
      );
    });

    it('reports upload progress', async () => {
      const mock = new MockXMLHttpRequest();
      const progress: number[] = [];

      await makeRawUploader(mock)(
        'bucket',
        'report.pdf',
        new File(['data'], 'report.pdf'),
        { onProgress: (percent) => progress.push(percent) },
      );

      expect(progress).toEqual([50, 100]);
    });

    it('attaches the current CSRF token and captures a rotated one', async () => {
      const mock = new MockXMLHttpRequest();
      mock.setMockResponseHeader('x-csrf-token', 'rotated-token');
      const setCsrfToken = vi.fn();

      await makeRawUploader(mock, {
        getCsrfToken: () => 'current-token',
        setCsrfToken,
      })('bucket', 'report.pdf', new File(['data'], 'report.pdf'), {});

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

      await expect(
        makeRawUploader(mock, { notifyUnauthorized })(
          'bucket',
          'report.pdf',
          new File(['data'], 'report.pdf'),
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedTestError);
      expect(notifyUnauthorized).toHaveBeenCalledWith('/api/v1/files');
    });

    it('aborts the request when the signal aborts', async () => {
      const mock = new MockXMLHttpRequest();
      mock.send = vi.fn();
      const controller = new AbortController();

      const result = makeRawUploader(mock)(
        'bucket',
        'report.pdf',
        new File(['data'], 'report.pdf'),
        { signal: controller.signal },
      );
      controller.abort();

      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(mock.abort).toHaveBeenCalledOnce();
    });
  });
});
