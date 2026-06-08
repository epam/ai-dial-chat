import type { DisplayAttachment, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SourcesSidebarProvider } from '../../../context/SourcesSidebarContext';
import ConversationSourcesPanel from '../ConversationSourcesPanel';

vi.mock('@epam/ai-dial-sidebar', () => ({
  SidebarPanel: ({
    children,
    ariaLabel,
    onClose,
    leftActions,
    rightActions,
  }: {
    children: ReactNode;
    ariaLabel: string;
    onClose: () => void;
    leftActions?: ReactNode;
    rightActions?: ReactNode;
  }) => (
    <aside aria-label={ariaLabel}>
      {leftActions}
      {rightActions}
      <button aria-label="Close" onClick={onClose} />
      <div>{children}</div>
    </aside>
  ),
  SidebarSide: { Right: 'right', Left: 'left' },
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { LG: 24 },
  DialGhostIconButton: ({
    'aria-label': ariaLabel,
    disabled,
  }: {
    'aria-label': string;
    disabled?: boolean;
  }) => <button type="button" aria-label={ariaLabel} disabled={disabled} />,
}));

vi.mock('@epam/ai-dial-conversation-input', () => ({
  AttachmentCard: ({ attachment }: { attachment: DisplayAttachment }) => (
    <div>{attachment.name}</div>
  ),
}));

const makeUserMessage = (attachmentTitle: string): Message => ({
  id: attachmentTitle,
  role: MessageRole.User,
  content: 'hi',
  timestamp: '',
  custom_content: {
    attachments: [{ title: attachmentTitle, type: 'application/pdf' }],
  },
});

const makeAssistantMessage = (attachmentTitle: string): Message => ({
  id: attachmentTitle,
  role: MessageRole.Assistant,
  content: 'ok',
  timestamp: '',
  custom_content: {
    attachments: [{ title: attachmentTitle, type: 'text/csv' }],
  },
});

const renderPanel = (messages: Message[] = []) =>
  render(
    <SourcesSidebarProvider>
      <ConversationSourcesPanel messages={messages} />
    </SourcesSidebarProvider>,
  );

describe('ConversationSourcesPanel', () => {
  it('derives uploaded files from user messages', () => {
    renderPanel([makeUserMessage('upload.pdf')]);
    expect(screen.getByText('upload.pdf')).toBeTruthy();
  });

  it('derives generated files from assistant messages', () => {
    renderPanel([makeAssistantMessage('result.csv')]);
    expect(screen.getByText('result.csv')).toBeTruthy();
  });

  it('close button calls useSourcesSidebar().handleClose via context', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('renders three sections in order', () => {
    renderPanel();
    const headings = screen.getAllByRole('heading');
    const texts = headings.map((h) => h.textContent);
    expect(texts).toContain('sidebar.sources.sections.uploadedFiles');
    expect(texts).toContain('sidebar.sources.sections.generatedFiles');
    expect(texts).toContain('sidebar.sources.sections.sources');
    const uploadedIdx = texts.indexOf('sidebar.sources.sections.uploadedFiles');
    const generatedIdx = texts.indexOf(
      'sidebar.sources.sections.generatedFiles',
    );
    const sourcesIdx = texts.indexOf('sidebar.sources.sections.sources');
    expect(uploadedIdx).toBeLessThan(generatedIdx);
    expect(generatedIdx).toBeLessThan(sourcesIdx);
  });
});
