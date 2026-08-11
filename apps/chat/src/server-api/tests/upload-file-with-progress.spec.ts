import type { FileUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadFileWithProgress } from '../upload-file-with-progress';

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

  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    this.triggerUploadProgress(50);
    this.triggerUploadProgress(100);
    this.trigger('load');
  });
  abort = vi.fn(() => this.trigger('abort'));
  getResponseHeader = vi.fn(() => null);

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  addEventListener(type: string, listener: XhrListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
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

describe('uploadFileWithProgress', () => {
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
    const result = await uploadFileWithProgress(
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
});
