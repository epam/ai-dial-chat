import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewVersionAlert, type NewVersionAlertProps } from '../NewVersionAlert';

const renderAlert = (props?: Partial<NewVersionAlertProps>) =>
  render(<NewVersionAlert onReload={vi.fn()} {...props} />);

describe('NewVersionAlert', () => {
  it('renders the English defaults', () => {
    render(<NewVersionAlert onReload={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'New version available' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Reload the page to get the latest version.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Reload the page' }),
    ).toBeTruthy();
  });

  it('renders host-supplied labels', () => {
    render(
      <NewVersionAlert
        onReload={vi.fn()}
        labels={{
          heading: 'Доступна новая версия',
          message: 'Перезагрузите страницу.',
          reloadLabel: 'Перезагрузить',
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Доступна новая версия' }),
    ).toBeTruthy();
    expect(screen.getByText('Перезагрузите страницу.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeTruthy();
  });

  it('renders a region named by the heading, not a live region', () => {
    renderAlert();

    expect(
      screen.getByRole('region', { name: 'New version available' }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('focuses the reload button on mount', () => {
    renderAlert();

    expect(
      screen.getByRole('button', { name: 'Reload the page' }).matches(':focus'),
    ).toBe(true);
  });

  it('calls onReload when the reload button is clicked', async () => {
    const onReload = vi.fn();
    render(<NewVersionAlert onReload={onReload} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Reload the page' }),
    );

    expect(onReload).toHaveBeenCalledOnce();
  });

  it('sets the icon color variable from colors', () => {
    const { container } = renderAlert({ colors: { icon: 'red' } });
    // eslint-disable-next-line testing-library/no-node-access -- the CSS var sits on the root, which has no role
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--nva-icon')).toBe('red');
  });
});
