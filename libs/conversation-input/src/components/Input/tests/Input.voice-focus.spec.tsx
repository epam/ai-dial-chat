import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseVoiceRecorderOptions } from '../../../hooks/useVoiceRecorder';
import type { CommandMenuConfig } from '../../../models/Input';
import { Input } from '../Input';

let finishDictation: (text: string) => void = () => undefined;

vi.mock('../../../hooks/useVoiceRecorder', async () => {
  const { useState: useMockState } = await import('react');
  return {
    VoiceRecorderState: {
      Idle: 'idle',
      Recording: 'recording',
      Processing: 'processing',
      Error: 'error',
    },
    VoiceRecordingMode: { Dictation: 'dictation', Attachment: 'attachment' },
    useVoiceRecorder: ({ onTranscript }: UseVoiceRecorderOptions) => {
      const [state, setState] = useMockState('idle');
      finishDictation = (text: string) => {
        onTranscript?.(text);
        setState('idle');
      };
      return {
        state,
        analyserNodeRef: { current: null },
        errorMessage: null,
        startRecording: () => setState('recording'),
        stopRecording: vi.fn(),
        discardRecording: vi.fn(),
      };
    },
  };
});

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Dropdown: ({
      children,
      open,
      renderOverlay,
    }: {
      children: ReactNode;
      open?: boolean;
      renderOverlay?: () => ReactNode;
    }) => (
      <div>
        {children}
        {open && renderOverlay && createPortal(renderOverlay(), document.body)}
      </div>
    ),
  };
});

const commandMenu: CommandMenuConfig = {
  triggerPrefix: '/',
  menuLabel: 'Skills',
  renderMenu: ({ listboxId }) => (
    <ul role="listbox" id={listboxId} aria-label="Skills list" />
  ),
};

describe('Input dictation focus', () => {
  beforeEach(() => {
    finishDictation = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  it('puts the caret at the end and keeps the command menu closed after dictating next to a leading skill', async () => {
    render(
      <Input
        message="/answer-as-pirate "
        isAudioMessageSupported
        commandMenu={commandMenu}
      />,
    );

    await userEvent.click(screen.getByLabelText('Dictate'));
    await act(async () => {
      finishDictation('Hello to everyone.');
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('/answer-as-pirate Hello to everyone.');
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
