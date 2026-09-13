import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

const stopTrack = vi.fn();
const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: mockUseIsMobile };
});

class Recorder {
  static isTypeSupported = () => true;
  mimeType = 'audio/webm';
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio']) });
      this.onstop?.();
    });
  }
}

describe('Input while dictating', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.stubGlobal('navigator', {
      platform: 'Win32',
      userAgent: navigator.userAgent,
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    vi.stubGlobal(
      'AudioContext',
      class {
        close = vi.fn().mockResolvedValue(undefined);
        createAnalyser = () => ({
          fftSize: 256,
          getByteTimeDomainData: (data: Uint8Array) => data.fill(144),
        });
        createMediaStreamSource = () => ({ connect: vi.fn() });
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps the draft during capture, recognizes once after Stop, then focuses the editable result', async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    let resolve!: (text: string) => void;
    const onTranscribeAudio = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    render(
      <Input
        message="Draft"
        isAudioMessageSupported
        onSend={onSend}
        onChange={onChange}
        onTranscribeAudio={onTranscribeAudio}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dictate'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(screen.queryByRole('textbox')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(12000));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByLabelText('Stop recording')).toBeTruthy();
    expect(screen.queryByRole('textbox', { hidden: true })).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
    expect(onTranscribeAudio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Stop recording'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(onTranscribeAudio).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).toBeNull();
    await act(async () => resolve('Whole recording'));
    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Draft Whole recording',
    );
    expect(screen.getByRole('textbox')).toHaveProperty('readOnly', false);
    // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
    expect(screen.getByRole('textbox')).toBe(document.activeElement);
    expect(onChange).toHaveBeenLastCalledWith('Draft Whole recording');
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it('keeps the original draft when recognition is cancelled', async () => {
    let resolve!: (text: string) => void;
    const onTranscribeAudio = vi.fn().mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    render(
      <Input
        message="Draft"
        isAudioMessageSupported
        onTranscribeAudio={onTranscribeAudio}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dictate'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(onTranscribeAudio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Stop recording'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(onTranscribeAudio).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByLabelText('Discard recording'));
    await act(async () => resolve('cancelled'));
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Draft');
    expect(screen.getByRole('textbox')).toHaveProperty('readOnly', false);
    expect(stopTrack).toHaveBeenCalledOnce();
  });
  it.each([false, true])(
    'records an attachment from the menu without dictating (mobile=%s)',
    async (mobile) => {
      mockUseIsMobile.mockReturnValue(mobile);
      const onTranscribeAudio = vi.fn();
      const onUploadAttachment = vi
        .fn()
        .mockResolvedValue('files/bucket/voice.webm');
      const onChange = vi.fn();
      render(
        <Input
          message="Draft"
          isAudioMessageSupported
          onTranscribeAudio={onTranscribeAudio}
          onUploadAttachment={onUploadAttachment}
          onChange={onChange}
          menuOverlays={[
            {
              key: 'prompts',
              title: 'Prompts',
              icon: <span aria-hidden />,
              renderOverlay: () => <div>prompts overlay</div>,
            },
          ]}
          chatSettings={{
            features: { systemPrompt: false, temperature: false },
            systemPrompt: '',
            temperature: 1,
            onSave: vi.fn(),
          }}
        />,
      );
      fireEvent.click(screen.getByLabelText('Add'));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      const choices = screen.getAllByText(
        /^(Attach file|Prompts|Record voice|Chat settings)$/,
      );
      expect(choices.map((item) => item.textContent)).toEqual([
        'Attach file',
        'Prompts',
        'Record voice',
        'Chat settings',
      ]);
      fireEvent.click(screen.getByText('Record voice'));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(screen.queryByRole('textbox', { hidden: true })).toBeNull();
      expect(screen.getByLabelText('Stop recording')).toBeTruthy();
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(onUploadAttachment).not.toHaveBeenCalled();
      fireEvent.click(screen.getByLabelText('Stop recording'));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(onUploadAttachment).toHaveBeenCalledOnce();
      expect(onUploadAttachment.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          name: expect.stringMatching(/\.webm$/),
          file: expect.objectContaining({ type: 'audio/webm', size: 5 }),
        }),
      );
      expect(onTranscribeAudio).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox')).toHaveProperty('value', 'Draft');
      expect(stopTrack).toHaveBeenCalledOnce();
    },
  );

  it('hides recording when audio attachments are unsupported but retains Dictate', async () => {
    render(<Input isAudioMessageSupported isVoiceRecordingSupported={false} />);
    expect(screen.getByLabelText('Dictate')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(screen.queryByText('Record voice')).toBeNull();
  });
});
