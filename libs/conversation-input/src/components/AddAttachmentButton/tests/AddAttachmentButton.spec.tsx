import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddAttachmentButton } from '../AddAttachmentButton';

const defaultProps = {
  onAttachClick: vi.fn(),
  attachLabel: 'Attach file',
  addMenuLabel: 'Add',
  menuTitle: 'Menu',
  menuCloseLabel: 'Close',
};

describe('AddAttachmentButton', () => {
  it('renders only "Attach file" when extraMenuItems is absent', async () => {
    render(<AddAttachmentButton {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(screen.queryByText('DIAL file system')).toBeNull();
  });

  it('renders the extra item label when extraMenuItems has one entry', async () => {
    render(
      <AddAttachmentButton
        {...defaultProps}
        extraMenuItems={[
          {
            key: 'dial-fs',
            label: 'DIAL file system',
            icon: null,
            onClick: vi.fn(),
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    expect(await screen.findByText('Attach file')).toBeTruthy();
    expect(await screen.findByText('DIAL file system')).toBeTruthy();
  });

  it('calls onClick of the extra item when clicked', async () => {
    const handleClick = vi.fn();
    render(
      <AddAttachmentButton
        {...defaultProps}
        extraMenuItems={[
          {
            key: 'dial-fs',
            label: 'DIAL file system',
            icon: null,
            onClick: handleClick,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(await screen.findByText('DIAL file system'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
