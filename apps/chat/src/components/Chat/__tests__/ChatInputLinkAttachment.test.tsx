import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { ChatInputLinkAttachment } from '@/src/components/Chat/ChatInput/ChatInputLinkAttachment';

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Vitest resolves svg imports to a url string, unlike the svgr webpack loader.
vi.mock('@/public/images/icons/arrow-up-right-from-square.svg', () => ({
  default: () => <svg data-qa="link-icon" />,
}));

describe('<ChatInputLinkAttachment />', () => {
  it('opens the attached link in a new tab', () => {
    render(
      <ChatInputLinkAttachment
        link={{ href: 'https://example.com/page', title: 'Example' }}
      />,
    );

    const name = screen.getByRole('link', { name: 'Example' });

    expect(name).toHaveAttribute('href', 'https://example.com/page');
    expect(name).toHaveAttribute('target', '_blank');
    expect(name).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('falls back to the href when the link has no title', () => {
    render(
      <ChatInputLinkAttachment link={{ href: 'https://example.com/page' }} />,
    );

    expect(
      screen.getByRole('link', { name: 'https://example.com/page' }),
    ).toBeInTheDocument();
  });

  it('renders an "Open link" action next to the name', () => {
    render(
      <ChatInputLinkAttachment
        link={{ href: 'https://example.com/page', title: 'Example' }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open link' })).toBeInTheDocument();
  });

  it('does not make an unsafe url clickable', () => {
    render(
      <ChatInputLinkAttachment
        link={{ href: 'javascript:alert(1)', title: 'Example' }}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
  });
});
