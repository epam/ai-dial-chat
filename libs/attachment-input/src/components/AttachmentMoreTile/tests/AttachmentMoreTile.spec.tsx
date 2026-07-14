import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentMoreTile } from '../AttachmentMoreTile';

describe('AttachmentMoreTile', () => {
  it('renders the hidden count', () => {
    render(<AttachmentMoreTile count={9} onClick={vi.fn()} />);
    expect(screen.getByText('+9')).toBeTruthy();
  });

  it('announces the hidden count via its accessible name', () => {
    render(<AttachmentMoreTile count={9} onClick={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Show 9 more attachments' }),
    ).toBeTruthy();
  });

  it('calls onClick when activated', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<AttachmentMoreTile count={9} onClick={handleClick} />);

    await user.click(
      screen.getByRole('button', { name: 'Show 9 more attachments' }),
    );

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('accepts a custom aria-label', () => {
    render(
      <AttachmentMoreTile count={9} onClick={vi.fn()} ariaLabel="9 more" />,
    );
    expect(screen.getByRole('button', { name: '9 more' })).toBeTruthy();
  });

  it('renders custom children (e.g. a collapse icon) instead of "+N", in the same tile form', () => {
    render(
      <AttachmentMoreTile count={0} onClick={vi.fn()} ariaLabel="Show less">
        <span>collapse-icon</span>
      </AttachmentMoreTile>,
    );
    expect(screen.queryByText('+0')).toBeNull();
    expect(screen.getByText('collapse-icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();
  });

  it('isolates the "+N" count from the page direction so it never visually reorders to "N+" in RTL', () => {
    render(<AttachmentMoreTile count={9} onClick={vi.fn()} />);
    const countEl = screen.getByText('+9');
    expect(countEl.tagName).toBe('BDI');
    expect(countEl.getAttribute('dir')).toBe('ltr');
  });
});
