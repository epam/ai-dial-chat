import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilesSection from '../FilesSection';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentCard: ({
    attachment,
    onClick,
    clickLabel,
  }: {
    attachment: DisplayAttachment;
    onClick?: () => void;
    clickLabel?: string;
  }) =>
    onClick ? (
      <button type="button" aria-label={clickLabel} onClick={onClick}>
        {attachment.name}
      </button>
    ) : (
      <div>{attachment.name}</div>
    ),
}));

const makeAttachment = (name: string): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
});

const renderSection = (
  attachments: DisplayAttachment[],
  props?: Partial<Parameters<typeof FilesSection>[0]>,
) =>
  render(<FilesSection attachments={attachments} title="Files" {...props} />);

describe('FilesSection', () => {
  it('renders the title', () => {
    renderSection([makeAttachment('a.pdf')]);
    expect(screen.getByText('Files')).toBeTruthy();
  });

  it('renders nothing when no attachments', () => {
    renderSection([]);
    expect(screen.queryByText('Files')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders a card per attachment', () => {
    const attachments = [makeAttachment('a.pdf'), makeAttachment('b.pdf')];
    renderSection(attachments);
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('b.pdf')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('has role=list grid when attachments present', () => {
    renderSection([makeAttachment('a.pdf')]);
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('cards have no onClick when onAttachmentClick is not provided', () => {
    renderSection([makeAttachment('a.pdf')]);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('activating a card calls onAttachmentClick with the correct attachment', () => {
    const onAttachmentClick = vi.fn();
    const att = makeAttachment('a.pdf');
    renderSection([att], { onAttachmentClick });
    fireEvent.click(screen.getByRole('button'));
    expect(onAttachmentClick).toHaveBeenCalledWith(att);
  });
});
