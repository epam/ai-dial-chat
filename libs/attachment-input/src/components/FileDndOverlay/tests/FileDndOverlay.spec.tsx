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
      <FileDndOverlay
        isVisible={true}
        styles={{ iconClassName: 'text-red-500' }}
      />,
    );
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-red-500');
  });

  it('renders denied title and subtitle when isAttachmentsAllowed is false', () => {
    render(<FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />);
    expect(screen.getByText('No attachments allowed')).toBeTruthy();
    expect(
      screen.getByText("Attachments can't be added to message"),
    ).toBeTruthy();
  });

  it('applies default deniedIconClassName (text-error) when isAttachmentsAllowed is false', () => {
    const { container } = render(
      <FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />,
    );
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-error');
  });

  it('applies custom deniedIconClassName when isAttachmentsAllowed is false', () => {
    const { container } = render(
      <FileDndOverlay
        isVisible={true}
        isAttachmentsAllowed={false}
        styles={{ deniedIconClassName: 'text-warning' }}
      />,
    );
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('text-warning');
  });

  it('applies cursor-not-allowed when isAttachmentsAllowed is false', () => {
    const { container } = render(
      <FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />,
    );
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('cursor-not-allowed');
  });

  it('calls preventDefault on drop when isAttachmentsAllowed is false', () => {
    const { container } = render(
      <FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />,
    );
    const overlay = container.firstChild as HTMLElement;
    const dropEvent = new MouseEvent('drop', {
      bubbles: true,
      cancelable: true,
    });
    overlay.dispatchEvent(dropEvent);
    expect(dropEvent.defaultPrevented).toBe(true);
  });
});
