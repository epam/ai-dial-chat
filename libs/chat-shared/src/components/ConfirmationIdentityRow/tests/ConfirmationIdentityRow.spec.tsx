import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmationIdentityRow } from '../ConfirmationIdentityRow';

const renderRow = (
  props?: Partial<Parameters<typeof ConfirmationIdentityRow>[0]>,
) => render(<ConfirmationIdentityRow name="Daily summary" {...props} />);

describe('ConfirmationIdentityRow', () => {
  it('renders the name on its own', () => {
    renderRow();

    expect(screen.getByText('Daily summary')).toBeTruthy();
  });

  it('renders the type above the name when given', () => {
    renderRow({ typeLabel: 'Scheduled task' });

    expect(screen.getByText('Scheduled task')).toBeTruthy();
  });

  it('renders the host icon', () => {
    renderRow({ icon: <svg aria-label="Task" /> });

    expect(screen.getByLabelText('Task')).toBeTruthy();
  });

  it('applies the typography classes', () => {
    renderRow({
      typeLabel: 'Chat',
      styles: {
        typeLabelClassName: 'custom-type',
        nameClassName: 'custom-name',
      },
    });

    expect(screen.getByText('Chat').classList).toContain('custom-type');
    expect(screen.getByText('Daily summary').classList).toContain(
      'custom-name',
    );
  });
});

/*
 * The type label's color is a custom property on the row root, which no
 * accessible query reaches.
 */
/* eslint-disable testing-library/no-node-access */
describe('ConfirmationIdentityRow color override', () => {
  it('wires the type label color to the property the stylesheet reads', () => {
    const { container } = renderRow({
      typeLabel: 'Chat',
      styles: { colors: { typeLabelText: 'rgb(1, 2, 3)' } },
    });
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--cir-type-label-text')).toBe(
      'rgb(1, 2, 3)',
    );
  });
});
