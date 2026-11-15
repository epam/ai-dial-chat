import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProjectRemoveFromListConfirmation from '../ProjectRemoveFromListConfirmation';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

describe('ProjectRemoveFromListConfirmation', () => {
  const renderDialog = (
    props?: Partial<
      React.ComponentProps<typeof ProjectRemoveFromListConfirmation>
    >,
  ) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ProjectRemoveFromListConfirmation
        isOpen
        projectName="Q4 launch"
        isRemoving={false}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />,
    );
    return { onConfirm, onClose };
  };

  it('names the project and lists the consequences', () => {
    renderDialog();

    expect(screen.getByText('Q4 launch')).toBeTruthy();
    expect(
      screen.getByText('catalog.details.unshare.consequenceYouLoseAccess'),
    ).toBeTruthy();
    expect(
      screen.getByText('catalog.details.unshare.consequenceOthersKeepAccess'),
    ).toBeTruthy();
  });

  it('calls onConfirm when Remove from My List is confirmed', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.removeFromMyList' }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose and not onConfirm when cancelled', async () => {
    const { onConfirm, onClose } = renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('button', { name: 'buttons.cancel' })).toBeNull();
  });
});
