import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileDndOverlay } from '../FileDndOverlay';

describe('FileDndOverlay', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(<FileDndOverlay isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders default title and subtitle when isVisible is true', () => {
    render(<FileDndOverlay isVisible={true} />);
    expect(screen.getByText('Attach files')).toBeTruthy();
    expect(
      screen.getByText('Drop files here to attach them to message'),
    ).toBeTruthy();
  });

  it('renders custom title and subtitle', () => {
    render(
      <FileDndOverlay
        isVisible={true}
        title="Add attachments"
        subtitle="Drop here"
      />,
    );
    expect(screen.getByText('Add attachments')).toBeTruthy();
    expect(screen.getByText('Drop here')).toBeTruthy();
  });

  it('applies custom iconClassName', () => {
    const { container } = render(
      <FileDndOverlay isVisible={true} iconClassName="text-red-500" />,
    );
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-red-500');
  });
});
