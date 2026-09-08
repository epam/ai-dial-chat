import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfWorkerMock = vi.hoisted(() => {
  let assignmentCount = 0;
  let shouldReject = false;
  const globalWorkerOptions = {} as { workerSrc: string };

  Object.defineProperty(globalWorkerOptions, 'workerSrc', {
    configurable: true,
    set: () => {
      assignmentCount += 1;
      if (shouldReject) {
        shouldReject = false;
        throw new Error('worker setup failed');
      }
    },
  });

  return {
    globalWorkerOptions,
    rejectNextAssignment: () => {
      shouldReject = true;
    },
    getAssignmentCount: () => assignmentCount,
    reset: () => {
      assignmentCount = 0;
      shouldReject = false;
    },
  };
});

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: pdfWorkerMock.globalWorkerOptions,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '/assets/pdf.worker.min.mjs',
}));

describe('configurePdfWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    pdfWorkerMock.reset();
  });

  it('shares and memoizes successful worker configuration', async () => {
    const { configurePdfWorker } = await import('../pdf');

    const firstCall = configurePdfWorker();
    const concurrentCall = configurePdfWorker();

    expect(concurrentCall).toBe(firstCall);
    await Promise.all([firstCall, concurrentCall]);
    await configurePdfWorker();

    expect(pdfWorkerMock.getAssignmentCount()).toBe(1);
  });

  it('clears a rejected configuration so the next call can retry', async () => {
    const { configurePdfWorker } = await import('../pdf');
    pdfWorkerMock.rejectNextAssignment();

    await expect(configurePdfWorker()).rejects.toThrow('worker setup failed');
    await expect(configurePdfWorker()).resolves.toBeUndefined();

    expect(pdfWorkerMock.getAssignmentCount()).toBe(2);
  });
});
