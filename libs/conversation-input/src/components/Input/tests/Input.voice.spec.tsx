import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseVoiceRecorderOptions } from '../../../hooks/useVoiceRecorder';
import { Input } from '../Input';

let transcript = 'recognized speech';

vi.mock('../../../hooks/useVoiceRecorder', () => ({
  VoiceRecorderState: { Idle: 'idle' },
  VoiceRecordingMode: { Dictation: 'dictation', Attachment: 'attachment' },
  useVoiceRecorder: ({ onTranscript }: UseVoiceRecorderOptions) => ({
    state: 'idle',
    analyserNodeRef: { current: null },
    errorMessage: null,
    startRecording: () => onTranscript?.(transcript),
    stopRecording: vi.fn(),
    discardRecording: vi.fn(),
  }),
}));

describe('Input dictation', () => {
  beforeEach(() => {
    transcript = 'recognized speech';
  });

  it('leaves the draft untouched when no speech is recognized', () => {
    transcript = '  ';
    const onChange = vi.fn();
    render(
      <Input
        message="Existing draft"
        isAudioMessageSupported
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dictate'));
    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Existing draft',
    );
    expect(onChange).not.toHaveBeenCalled();
  });
  it('appends recognized speech, reports the draft and does not upload or send', () => {
    const onChange = vi.fn();
    const onSend = vi.fn();
    const onUploadAttachment = vi.fn();
    render(
      <Input
        message="Existing draft"
        isAudioMessageSupported
        onChange={onChange}
        onSend={onSend}
        onUploadAttachment={onUploadAttachment}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dictate'));
    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Existing draft recognized speech',
    );
    expect(onChange).toHaveBeenCalledWith('Existing draft recognized speech');
    expect(onSend).not.toHaveBeenCalled();
    expect(onUploadAttachment).not.toHaveBeenCalled();
  });

  it('preserves trailing whitespace in an existing draft', () => {
    render(<Input message={'Existing draft\n'} isAudioMessageSupported />);
    fireEvent.click(screen.getByLabelText('Dictate'));
    expect(screen.getByRole('textbox')).toHaveProperty(
      'value',
      'Existing draft\nrecognized speech',
    );
  });
});
