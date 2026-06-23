import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AttachmentCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { AttachmentCanvas } from '../AttachmentCanvas';

const plainTextContent: AttachmentCanvasContent = {
  type: AttachmentContentType.PlainText,
  text: 'Hello, world!\nSecond line.',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  content: plainTextContent,
  fileName: 'notes.txt',
  ariaLabel: 'Attachment canvas',
};

describe('AttachmentCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel region when isOpen is true', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(
      screen.getByRole('complementary', { name: 'Attachment canvas' }),
    ).toBeDefined();
  });

  it('hides the panel when isOpen is false', () => {
    render(<AttachmentCanvas {...defaultProps} isOpen={false} />);
    const panel = screen.getByRole('complementary', { hidden: true });
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the file name as the panel title', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.getByText('notes.txt')).toBeDefined();
  });

  it('renders plain text content', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.getByText(/Hello, world!/)).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render a download button when onDownload is not provided', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('renders a download button when onDownload is provided', () => {
    const onDownload = vi.fn();
    render(<AttachmentCanvas {...defaultProps} onDownload={onDownload} />);
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = vi.fn();
    render(<AttachmentCanvas {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('uses a custom downloadLabel for the download button aria-label', () => {
    render(
      <AttachmentCanvas
        {...defaultProps}
        onDownload={vi.fn()}
        downloadLabel="Save file"
      />,
    );
    expect(screen.getByRole('button', { name: 'Save file' })).toBeDefined();
  });

  it('uses a custom closeLabel for the close button aria-label', () => {
    render(<AttachmentCanvas {...defaultProps} closeLabel="Dismiss" />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });
});
