import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRemoveFromListConfirmationProps } from '../../../models/project-remove-from-list-confirmation-props';
import { ProjectRemoveFromListConfirmation } from '../ProjectRemoveFromListConfirmation';

describe('ProjectRemoveFromListConfirmation', () => {
  const renderDialog = (
    props?: Partial<ProjectRemoveFromListConfirmationProps>,
  ) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ProjectRemoveFromListConfirmation
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
    expect(screen.getByText('Other people keep their access')).toBeTruthy();
  });

  it('calls onConfirm when Remove from My List is confirmed', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from My List' }),
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
});
