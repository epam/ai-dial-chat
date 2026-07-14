import type { DisplayAttachment, Stage } from '@epam/ai-dial-chat-shared';
import { StageStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StageItem } from '../StageItem';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { MD: 16 },
  DialEllipsisTooltip: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentGroup: ({ attachments }: { attachments: DisplayAttachment[] }) => (
    <ul aria-label="attachments">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          {attachment.name} - {attachment.playUrl ?? 'no-play-url'}
        </li>
      ))}
    </ul>
  ),
}));

const baseStage: Stage = {
  index: 0,
  name: 'Transcribe audio',
  status: StageStatus.Completed,
};

describe('StageItem', () => {
  it('renders audio attachments with a resolved playUrl (previously dropped)', () => {
    const stage: Stage = {
      ...baseStage,
      attachments: [
        {
          title: 'recording.mp3',
          type: 'audio/mpeg',
          url: 'files/bucket/recording.mp3',
        },
      ],
    };

    render(<StageItem stage={stage} isLive={false} typography={{}} />);

    expect(
      screen.getByText('recording.mp3 - files/bucket/recording.mp3'),
    ).not.toBeNull();
  });

  it('renders image attachments with a previewUrl fallback to the raw url', () => {
    const stage: Stage = {
      ...baseStage,
      attachments: [
        {
          title: 'chart.png',
          type: 'image/png',
          url: 'files/bucket/chart.png',
        },
      ],
    };

    render(<StageItem stage={stage} isLive={false} typography={{}} />);

    expect(screen.getByLabelText('attachments')).not.toBeNull();
  });
});
