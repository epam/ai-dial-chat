import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileDndOverlay } from '../FileDndOverlay';

/* The visual overlay has no role of its own; walk up from its title text. */
const getOverlay = (): HTMLElement => {
  const title = screen.getByText(/^(Attach files|No attachments allowed)$/);
  // eslint-disable-next-line testing-library/no-node-access -- see above
  return title.closest('.fixed') as HTMLElement;
};

describe('FileDndOverlay', () => {
  it('keeps an empty status region mounted while hidden and fills it when shown', () => {
    const { rerender } = render(<FileDndOverlay isVisible={false} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(screen.queryByText('Attach files')).toBeNull();

    rerender(<FileDndOverlay isVisible={true} />);

    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe(
      'Attach files. Drop files here to attach them to message',
    );
  });

  it('renders default title and subtitle when isVisible is true', () => {
    render(<FileDndOverlay isVisible={true} />);
    expect(screen.getByText('Attach files')).toBeTruthy();
    expect(
      screen.getByText('Drop files here to attach them to message'),
    ).toBeTruthy();
  });

  it.each([true, false])(
    'draws its decorative illustration at the empty-state stroke (allowed: %s)',
    (isAttachmentsAllowed) => {
      render(
        <FileDndOverlay
          isVisible={true}
          isAttachmentsAllowed={isAttachmentsAllowed}
        />,
      );
      // eslint-disable-next-line testing-library/no-node-access -- stroke width on an aria-hidden glyph has no accessible role or text to query
      const icon = getOverlay().querySelector('svg');
      expect(icon?.getAttribute('stroke-width')).toBe('1');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('renders custom title and subtitle', () => {
    render(
      <FileDndOverlay
        isVisible={true}
        labels={{ title: 'Add attachments', subtitle: 'Drop here' }}
      />,
    );
    expect(screen.getByText('Add attachments')).toBeTruthy();
    expect(screen.getByText('Drop here')).toBeTruthy();
  });

  it('renders denied title and subtitle when isAttachmentsAllowed is false', () => {
    render(<FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />);
    expect(screen.getByText('No attachments allowed')).toBeTruthy();
    expect(
      screen.getByText("Attachments can't be added to message"),
    ).toBeTruthy();
  });

  it('applies cursor-not-allowed when isAttachmentsAllowed is false', () => {
    render(<FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />);
    const overlay = getOverlay();
    expect(overlay.className).toContain('cursor-not-allowed');
  });

  it('calls preventDefault on drop when isAttachmentsAllowed is false', () => {
    render(<FileDndOverlay isVisible={true} isAttachmentsAllowed={false} />);
    const overlay = getOverlay();
    const dropEvent = new MouseEvent('drop', {
      bubbles: true,
      cancelable: true,
    });
    overlay.dispatchEvent(dropEvent);
    expect(dropEvent.defaultPrevented).toBe(true);
  });
});
