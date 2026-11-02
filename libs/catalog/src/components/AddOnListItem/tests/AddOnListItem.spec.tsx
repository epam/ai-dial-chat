import { DialItemType } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { AddOnListItem, type AddOnListItemProps } from '../AddOnListItem';

const renderItem = (props: Partial<AddOnListItemProps> = {}) => {
  const handlers = { onOpen: vi.fn(), onRemove: vi.fn() };
  render(<AddOnListItem name="Figma" {...handlers} {...props} />);
  return handlers;
};

describe('AddOnListItem', () => {
  it('opens the item from a button named by its name and version', async () => {
    const { onOpen } = renderItem({ version: '1.0.0' });
    await userEvent.click(screen.getByRole('button', { name: 'Figma 1.0.0' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('describes the button by the line under the name', () => {
    renderItem({ description: 'github.com/org' });
    expect(
      screen.getByRole('button', {
        name: 'Figma',
        description: 'github.com/org',
      }),
    ).toBeTruthy();
  });

  it('shows a location as a breadcrumb trail and still opens the item', async () => {
    const { onOpen } = renderItem({
      fileType: DialItemType.Folder,
      path: ['DIAL', 'Docs', 'survey'],
      labels: { location: 'Location of Figma' },
    });
    expect(
      screen.getByRole('navigation', { name: 'Location of Figma' }),
    ).toBeTruthy();
    expect(screen.getByText('survey')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Figma' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('draws the logged-out badge for signed-out credentials', () => {
    renderItem({
      credentials: {
        authenticationType: ToolsetAuthenticationType.OAuth,
        isPublic: true,
        userStatus: CredentialStatus.SignedOut,
      },
      labels: { credentialsBadge: 'Sign in to use it' },
    });
    expect(
      screen.getByRole('img', { name: 'Sign in to use it', hidden: true }),
    ).toBeTruthy();
  });

  it('removes the item from a named trash that Tab reaches', async () => {
    const { onRemove } = renderItem();
    await userEvent.tab();
    await userEvent.tab();
    const trash = screen.getByRole('button', { name: 'Remove Figma' });
    expect(trash.matches(':focus')).toBe(true);
    await userEvent.click(trash);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('has no trash without onRemove', () => {
    render(<AddOnListItem name="Figma" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Remove Figma' })).toBeNull();
  });
});
