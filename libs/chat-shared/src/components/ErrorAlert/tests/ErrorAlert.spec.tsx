import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorAlert, type ErrorAlertProps } from '../ErrorAlert';

const renderAlert = (props?: Partial<ErrorAlertProps>) =>
  render(<ErrorAlert onAction={vi.fn()} {...props} />);

describe('ErrorAlert', () => {
  it('renders the English defaults', () => {
    renderAlert();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'An unexpected error occurred. You can try again or reload the page.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders host-supplied labels', () => {
    renderAlert({
      labels: {
        heading: 'Что-то пошло не так',
        message: 'Произошла ошибка.',
        actionLabel: 'Перезагрузить',
      },
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Что-то пошло не так' }),
    ).toBeTruthy();
    expect(screen.getByText('Произошла ошибка.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeTruthy();
  });

  it('calls onAction when the recovery button is clicked', async () => {
    const onAction = vi.fn();
    renderAlert({ onAction });

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('sets the icon color variable from colors', () => {
    const { container } = renderAlert({ colors: { icon: 'red' } });
    // eslint-disable-next-line testing-library/no-node-access -- the CSS var sits on the root, which has no role
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--ea-icon')).toBe('red');
  });
});
