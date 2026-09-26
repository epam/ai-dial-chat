import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddAttachmentButton } from '../AddAttachmentButton';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: mockUseIsMobile };
});

const defaultProps = {
  onAttachClick: vi.fn(),
  attachLabel: 'Attach file',
  addMenuTitle: 'Add',
  menuTitle: 'Menu',
  menuCloseLabel: 'Close',
};

describe('AddAttachmentButton', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(false);
  });

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

  it("passes the caret position from getCaretPosition into a menuOverlays entry's renderOverlay", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const renderOverlay = vi.fn(() => <div>Skills overlay</div>);
    render(
      <AddAttachmentButton
        {...defaultProps}
        getCaretPosition={() => 7}
        menuOverlays={[
          { key: 'skills', title: 'Skills', icon: null, renderOverlay },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(await screen.findByText('Skills'));

    expect(await screen.findByText('Skills overlay')).toBeTruthy();
    expect(renderOverlay).toHaveBeenCalledWith(expect.any(Function), 7);
  });

  it('passes 0 when getCaretPosition is absent', async () => {
    mockUseIsMobile.mockReturnValue(true);
    const renderOverlay = vi.fn(() => <div>Skills overlay</div>);
    render(
      <AddAttachmentButton
        {...defaultProps}
        menuOverlays={[
          { key: 'skills', title: 'Skills', icon: null, renderOverlay },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(await screen.findByText('Skills'));

    expect(await screen.findByText('Skills overlay')).toBeTruthy();
    expect(renderOverlay).toHaveBeenCalledWith(expect.any(Function), 0);
  });
});
