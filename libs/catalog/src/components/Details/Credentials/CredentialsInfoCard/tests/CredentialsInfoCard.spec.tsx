import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CredentialsInfoCard } from '../CredentialsInfoCard';

describe('CredentialsInfoCard', () => {
  it('renders the title without a live region of its own', () => {
    /* The card mounts together with its text, so callers own the live region. */
    render(<CredentialsInfoCard icon={<svg />} title="Title" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('omits the description when not provided', () => {
    const { container } = render(
      <CredentialsInfoCard icon={<svg />} title="Title" />,
    );
    expect(container.textContent).toBe('Title');
  });

  it('renders the description below the title, in DOM order', () => {
    const { container } = render(
      <CredentialsInfoCard icon={<svg />} title="Title" description="Body" />,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('Title')).toBeLessThan(text.indexOf('Body'));
  });

  it('renders the action alongside the title', () => {
    render(
      <CredentialsInfoCard
        icon={<svg />}
        title="Title"
        action={<button>Delete</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});
