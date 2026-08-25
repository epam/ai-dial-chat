import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CredentialsInfoCard } from '../CredentialsInfoCard';

describe('CredentialsInfoCard', () => {
  it('renders the icon, title, and a role="status" live region', () => {
    render(
      <CredentialsInfoCard icon={<svg data-testid="icon" />} title="Title" />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('omits the description when not provided', () => {
    render(<CredentialsInfoCard icon={<svg />} title="Title" />);
    expect(screen.getByRole('status').textContent).toBe('Title');
  });

  it('renders the description below the title, in DOM order', () => {
    render(
      <CredentialsInfoCard icon={<svg />} title="Title" description="Body" />,
    );
    const text = screen.getByRole('status').textContent ?? '';
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
