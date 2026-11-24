import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getLoadedConversationMessageItem,
  loadConversationMessageItem,
} from '../../../utils/conversation-message-loader';
import type { ConversationMessageItemProps } from '../../ConversationView/ConversationMessageItem';
import ConversationMessageItemLoader from '../ConversationMessageItemLoader';

vi.mock('../../ConversationView/ConversationMessageItem', () => ({
  default: ({ index }: { index: number }) => <p>message {index}</p>,
}));

const props = { index: 0 } as ConversationMessageItemProps;

describe('ConversationMessageItemLoader', () => {
  it('loads the message renderer on demand before it is preloaded', async () => {
    expect(getLoadedConversationMessageItem()).toBeUndefined();

    render(<ConversationMessageItemLoader {...props} />);

    expect(await screen.findByText('message 0')).toBeTruthy();
    expect(getLoadedConversationMessageItem()).toBeDefined();
  });

  it('renders the message in the first commit once the renderer is loaded', async () => {
    await loadConversationMessageItem();

    render(<ConversationMessageItemLoader {...props} />);

    expect(screen.getByText('message 0')).toBeTruthy();
  });

  it('starts one load however often it is asked', () => {
    expect(loadConversationMessageItem()).toBe(loadConversationMessageItem());
  });
});
