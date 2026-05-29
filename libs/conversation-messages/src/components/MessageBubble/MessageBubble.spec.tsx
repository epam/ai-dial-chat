import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BubblePosition } from '../../types/bubble-position.js';
import { AssistantMessageBubble } from './AssistantMessageBubble.js';
import { MessageBubble } from './MessageBubble.js';
import { UserMessageBubble } from './UserMessageBubble.js';

const ATTACHMENT: DisplayAttachment = {
  id: 'report.pdf',
  name: 'report.pdf',
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
};

describe('MessageBubble', () => {
  it('renders the provided text content', () => {
    const { getByText } = render(
      <MessageBubble text="Hello world" role={MessageRole.User} />,
    );
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies rounded-tr-[24px] with BubblePosition.Bottom (default)', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.User} />,
    );
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-tr-[24px]',
    );
  });

  it('applies rounded-br-[24px] with BubblePosition.Top', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        position={BubblePosition.Top}
      />,
    );
    expect(container.querySelector(':scope > * > * > *')?.className).toContain(
      'rounded-br-[24px]',
    );
  });

  it('merges additional className onto the container', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        className="my-custom-class"
      />,
    );
    expect(container.querySelector(':scope > *')?.className).toContain(
      'my-custom-class',
    );
  });

  it('does not apply user rounded classes for assistant messages', () => {
    const { container } = render(
      <MessageBubble text="msg" role={MessageRole.Assistant} />,
    );
    const innerClassName = container.querySelector(':scope > * > *')?.className;
    expect(innerClassName).not.toContain('rounded-tr-[24px]');
    expect(innerClassName).not.toContain('rounded-br-[24px]');
  });

  it('renders default user actions when no actions prop is given', () => {
    render(<MessageBubble text="msg" role={MessageRole.User} />);
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
  });

  it('renders user actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        actions={{ role: MessageRole.User }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeTruthy();
  });

  it('renders assistant actions from actions prop', () => {
    render(
      <MessageBubble
        text="msg"
        role={MessageRole.Assistant}
        actions={{ role: MessageRole.Assistant }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Regenerate response' }),
    ).toBeTruthy();
  });

  it('makes actions always visible when hasAlwaysVisibleActions is true', () => {
    const { container } = render(
      <MessageBubble
        text="msg"
        role={MessageRole.User}
        hasAlwaysVisibleActions
      />,
    );
    const actionsWrapper = container.querySelector('[class*="gap-1"]');
    expect(actionsWrapper?.className).not.toContain('opacity-0');
  });
});

describe('UserMessageBubble — attachments', () => {
  it('renders an attachment tray when attachments are provided', () => {
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);
    // AttachmentTray renders a list role
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('renders no attachment tray when attachments prop is absent', () => {
    render(<UserMessageBubble text="Hello" />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders no attachment tray when attachments array is empty', () => {
    render(<UserMessageBubble text="Hello" attachments={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the tray before the message text in the DOM', () => {
    const { container } = render(
      <UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />,
    );
    const inner = container.querySelector(
      '.flex.w-fit.flex-col',
    ) as HTMLElement;
    const children = Array.from(inner?.children ?? []);
    const trayIndex = children.findIndex(
      (el) => el.getAttribute('role') === 'list',
    );
    const textIndex = children.findIndex(
      (el) => el.tagName === 'DIV' && el.className.includes('rounded'),
    );
    // tray should come before the bubble
    expect(trayIndex).toBeLessThan(textIndex);
  });

  it('remove button does not trigger a callback (read-only tray)', () => {
    render(<UserMessageBubble text="Hello" attachments={[ATTACHMENT]} />);
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });
});

describe('AssistantMessageBubble — attachments', () => {
  it('renders an attachment tray when attachments are provided', () => {
    render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('renders no attachment tray when attachments prop is absent', () => {
    render(<AssistantMessageBubble text="Hello" />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders no attachment tray when attachments array is empty', () => {
    render(<AssistantMessageBubble text="Hello" attachments={[]} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the tray after the message text in the DOM', () => {
    const { container } = render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    const inner = container.querySelector(
      '.flex.w-fit.flex-col',
    ) as HTMLElement;
    const children = Array.from(inner?.children ?? []);
    const textIndex = children.findIndex((el) => el.tagName === 'P');
    const trayIndex = children.findIndex(
      (el) => el.getAttribute('role') === 'list',
    );
    // text comes before the tray
    expect(textIndex).toBeLessThan(trayIndex);
  });

  it('remove button does not trigger a callback (read-only tray)', () => {
    render(
      <AssistantMessageBubble
        text="Here is your file"
        attachments={[ATTACHMENT]}
      />,
    );
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });
});
