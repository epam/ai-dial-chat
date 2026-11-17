import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRevokeAccessConfirmationProps } from '../../../models/project-revoke-access-confirmation-props';
import { ProjectRevokeAccessConfirmation } from '../ProjectRevokeAccessConfirmation';

describe('ProjectRevokeAccessConfirmation', () => {
  const renderDialog = (
    props?: Partial<ProjectRevokeAccessConfirmationProps>,
  ) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ProjectRevokeAccessConfirmation
        isOpen
        projectName="Q4 launch"
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />,
    );
    return { onConfirm, onClose };
  };

  it('names the project and lists the default consequences', () => {
    renderDialog();

    expect(screen.getAllByText('Q4 launch').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Existing share links will stop working'),
    ).toBeTruthy();
  });

  it('calls onConfirm when Revoke access is confirmed', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke access' }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose and not onConfirm when cancelled', async () => {
    const { onConfirm, onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses the host labels', () => {
    renderDialog({
      labels: {
        title: 'Retirer',
        confirmLabel: 'Retirer de ma liste',
        cancelLabel: 'Annuler',
        consequences: ['Vous perdez l’accès'],
        message: (name) => `Retirer ${name} ?`,
      },
    });

    expect(
      screen.getByRole('button', { name: 'Retirer de ma liste' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(screen.getByText('Vous perdez l’accès')).toBeTruthy();
    expect(screen.getByText('Retirer Q4 launch ?')).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('blocks confirmation and dismissal while revoking', async () => {
    const { onConfirm, onClose } = renderDialog({ isRevoking: true });
    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke access' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
