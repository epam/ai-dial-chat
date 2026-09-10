import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscribeAudio } from '../../models/Voice';
import { useVoiceRecorder, VoiceRecorderState } from '../useVoiceRecorder';

const stopTrack = vi.fn();
const closeContext = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] };
let sampleValue = 144;
const recorders: Recorder[] = [];

class Recorder {
  static isTypeSupported = () => false;
  mimeType = 'audio/mp4';
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    recorders.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio']) });
    this.onstop?.();
  }
}

const setup = (onTranscribeAudio?: TranscribeAudio) => {
  const onAttachAudio = vi.fn();
  const onTranscript = vi.fn();
  const view = renderHook(() =>
    useVoiceRecorder({ onAttachAudio, onTranscribeAudio, onTranscript }),
  );
  return { ...view, onAttachAudio, onTranscript };
};

const start = async (result: ReturnType<typeof setup>['result']) => {
  act(() => result.current.startRecording());
  await waitFor(() =>
    expect(result.current.state).toBe(VoiceRecorderState.Recording),
  );
  await new Promise((resolve) => setTimeout(resolve, 110));
};

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recorders.length = 0;
    sampleValue = 144;
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal(
      'AudioContext',
      class {
        close = closeContext.mockResolvedValue(undefined);
        createAnalyser = () => ({
          fftSize: 256,
          getByteTimeDomainData: (samples: Uint8Array) =>
            samples.fill(sampleValue),
        });
        createMediaStreamSource = () => ({ connect: vi.fn() });
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('transcribes actual browser MIME and releases microphone before recognition completes', async () => {
    let resolve!: (text: string) => void;
    const transcribe = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const { result, onAttachAudio, onTranscript } = setup(transcribe);
    await start(result);
    act(() => result.current.stopRecording());
    expect(result.current.state).toBe(VoiceRecorderState.Processing);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(closeContext).toHaveBeenCalledOnce();
    expect(transcribe.mock.calls[0]).toBeDefined();
    await act(async () => resolve('Hello'));
    expect(onTranscript).toHaveBeenCalledWith('Hello');
    expect(onAttachAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe(VoiceRecorderState.Idle);
  });

  it('attaches audio when no recognition callback is provided', async () => {
    const { result, onAttachAudio } = setup();
    await start(result);
    act(() => result.current.stopRecording());
    expect(onAttachAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audio/mp4',
        name: expect.stringMatching(/\.mp4$/),
      }),
    );
  });

  it('ignores an old result after discard and a new recording', async () => {
    let resolve!: (text: string) => void;
    let signal!: AbortSignal;
    const { result, onTranscript } = setup((_file, nextSignal) => {
      signal = nextSignal;
      return new Promise((done) => {
        resolve = done;
      });
    });
    await start(result);
    act(() => result.current.stopRecording());
    act(() => result.current.discardRecording());
    expect(signal.aborted).toBe(true);
    await start(result);
    await act(async () => resolve('Stale text'));
    expect(onTranscript).not.toHaveBeenCalled();
    expect(result.current.state).toBe(VoiceRecorderState.Recording);
  });

  it('shows failures and lets discard restore idle state', async () => {
    const { result, onAttachAudio } = setup(async () => {
      throw new Error('Recognition failed');
    });
    await start(result);
    await act(async () => result.current.stopRecording());
    expect(result.current.state).toBe(VoiceRecorderState.Error);
    expect(result.current.errorMessage).toBe('Recognition failed');
    expect(onAttachAudio).not.toHaveBeenCalled();
    act(() => result.current.discardRecording());
    expect(result.current.state).toBe(VoiceRecorderState.Idle);
  });

  it('releases microphone if permission resolves after unmount', async () => {
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result, unmount } = setup();
    act(() => result.current.startRecording());
    unmount();
    await act(async () => resolve(stream as unknown as MediaStream));
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  describe('complete recording', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const begin = async (result: ReturnType<typeof setup>['result']) => {
      await act(async () => result.current.startRecording());
    };
    const advance = async (milliseconds: number) => {
      await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
    };

    it('waits for Stop and sends all blobs as one file exactly once', async () => {
      const transcribe = vi
        .fn<TranscribeAudio>()
        .mockResolvedValue('Whole text');
      const { result, onTranscript, onAttachAudio } = setup(transcribe);
      await begin(result);
      recorders[0].ondataavailable?.({ data: new Blob(['header']) });
      await advance(1500);
      sampleValue = 128;
      await advance(10000);
      sampleValue = 144;
      recorders[0].ondataavailable?.({ data: new Blob(['middle']) });
      await advance(20000);
      expect(recorders).toHaveLength(1);
      expect(transcribe).not.toHaveBeenCalled();
      expect(onTranscript).not.toHaveBeenCalled();
      expect(result.current.state).toBe(VoiceRecorderState.Recording);
      const stopEvent = recorders[0].onstop;
      await act(async () => {
        result.current.stopRecording();
        result.current.stopRecording();
        stopEvent?.();
      });
      expect(transcribe).toHaveBeenCalledOnce();
      expect(transcribe.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          type: 'audio/mp4',
          name: expect.stringMatching(/\.mp4$/),
          size: new Blob(['header', 'middle', 'audio']).size,
        }),
      );
      expect(onTranscript).toHaveBeenCalledExactlyOnceWith('Whole text');
      expect(onAttachAudio).not.toHaveBeenCalled();
      expect(result.current.state).toBe(VoiceRecorderState.Idle);
    });

    it('does not recognize a discarded recording', async () => {
      const transcribe = vi.fn<TranscribeAudio>();
      const { result, onTranscript } = setup(transcribe);
      await begin(result);
      await advance(30000);
      act(() => result.current.discardRecording());
      expect(stopTrack).toHaveBeenCalledOnce();
      expect(transcribe).not.toHaveBeenCalled();
      expect(onTranscript).not.toHaveBeenCalled();
      expect(result.current.state).toBe(VoiceRecorderState.Idle);
    });

    it('ignores final browser events after cancellation', async () => {
      const transcribe = vi.fn<TranscribeAudio>();
      const { result } = setup(transcribe);
      await begin(result);
      await advance(2000);
      const recorder = recorders[0];
      const finalStop = recorder.onstop;
      recorder.stop = () => {
        recorder.state = 'inactive';
      };
      act(() => result.current.stopRecording());
      expect(result.current.state).toBe(VoiceRecorderState.Processing);
      act(() => result.current.discardRecording());
      await act(async () => finalStop?.());
      expect(transcribe).not.toHaveBeenCalled();
      expect(stopTrack).toHaveBeenCalledOnce();
      expect(result.current.state).toBe(VoiceRecorderState.Idle);
    });

    it('releases late microphone permission after Stop without recognition', async () => {
      let resolve!: (value: MediaStream) => void;
      vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const transcribe = vi.fn<TranscribeAudio>();
      const { result } = setup(transcribe);
      await begin(result);
      act(() => result.current.stopRecording());
      await act(async () => resolve(stream as unknown as MediaStream));
      expect(stopTrack).toHaveBeenCalledOnce();
      expect(recorders).toHaveLength(0);
      expect(transcribe).not.toHaveBeenCalled();
      expect(result.current.state).toBe(VoiceRecorderState.Idle);
    });

    it.each([0, 50, 5000])(
      'skips empty or silent capture lasting %i ms but still notifies onTranscript so hosts can restore focus',
      async (duration) => {
        sampleValue = 128;
        const transcribe = vi.fn<TranscribeAudio>();
        const { result, onTranscript } = setup(transcribe);
        await begin(result);
        await advance(duration);
        await act(async () => result.current.stopRecording());
        expect(transcribe).not.toHaveBeenCalled();
        expect(onTranscript).toHaveBeenCalledExactlyOnceWith('');
        expect(result.current.state).toBe(VoiceRecorderState.Idle);
        expect(stopTrack).toHaveBeenCalledOnce();
      },
    );
  });
});
