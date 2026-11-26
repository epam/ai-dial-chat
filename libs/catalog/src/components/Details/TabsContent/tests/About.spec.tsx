import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutTab } from '../About';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  MarkdownRenderer: ({ content }: { content: string }) => <p>{content}</p>,
}));

describe('AboutTab', () => {
  it('renders the description followed by the topic tags', () => {
    render(<AboutTab content="A capable model" topics={['Chat', 'Code']} />);

    expect(screen.getByText('A capable model')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('Code')).toBeTruthy();
  });

  it('renders the supplied footer in place of the topic tags', () => {
    render(
      <AboutTab
        content="A capable model"
        topics={['Chat']}
        footer={<span>Capabilities</span>}
      />,
    );

    expect(screen.getByText('Capabilities')).toBeTruthy();
    expect(screen.queryByText('Chat')).toBeNull();
  });

  it('renders no topic tags when the supplied footer is null', () => {
    render(
      <AboutTab content="A capable model" topics={['Chat']} footer={null} />,
    );

    expect(screen.getByText('A capable model')).toBeTruthy();
    expect(screen.queryByText('Chat')).toBeNull();
  });
});
