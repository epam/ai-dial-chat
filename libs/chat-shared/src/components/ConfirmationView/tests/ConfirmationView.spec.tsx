import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EntityHeaderItem } from '../../../models/entity';
import { CatalogEntityType } from '../../../types/entity-type';
import { ConfirmationView } from '../ConfirmationView';

const item: EntityHeaderItem = {
  type: CatalogEntityType.Skill,
  name: 'Weekly digest',
  version: '1.0',
};

const renderView = (props?: Partial<Parameters<typeof ConfirmationView>[0]>) =>
  render(<ConfirmationView item={item} message="Are you sure?" {...props} />);

describe('ConfirmationView', () => {
  it('anchors the copy to the resource with an identity card', () => {
    renderView();

    expect(screen.getByRole('heading', { name: 'Weekly digest' })).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('renders no identity card when neither item nor identity is given', () => {
    renderView({ item: undefined });

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('renders the consequences as a list', () => {
    renderView({
      consequences: [
        'Users who rely on it will lose access',
        'Cannot be undone',
      ],
    });

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['Users who rely on it will lose access', 'Cannot be undone'],
    );
  });

  it('renders no list when there are no consequences', () => {
    renderView({ consequences: [] });

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders the identity slot in place of the default card', () => {
    renderView({ identity: <span>View task</span> });

    expect(screen.getByText('View task')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Weekly digest' })).toBeNull();
  });

  it('renders the interactive slot after the consequences', () => {
    renderView({
      consequences: ['Cannot be undone'],
      children: <button type="button">Pick a folder</button>,
    });

    expect(screen.getByRole('button', { name: 'Pick a folder' })).toBeTruthy();
  });

  it('applies the typography class to both the message and the bullets', () => {
    renderView({
      consequences: ['Cannot be undone'],
      messageClassName: 'custom-copy',
    });

    expect(screen.getByText('Are you sure?').classList).toContain(
      'custom-copy',
    );
    expect(screen.getByRole('list').classList).toContain('custom-copy');
  });
});

/*
 * Color overrides land as inline custom properties on the root, which no
 * accessible query can reach. Asserted because an unread variable is the
 * silent failure mode the lib styling guide calls out: the prop type compiles,
 * the host sets it, and nothing happens.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
describe('ConfirmationView color overrides', () => {
  it('wires the text colors to the custom properties the stylesheet reads', () => {
    const { container } = renderView({
      styles: {
        colors: {
          messageText: 'rgb(1, 2, 3)',
          consequenceText: 'rgb(4, 5, 6)',
        },
      },
    });
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--cfm-message-text')).toBe(
      'rgb(1, 2, 3)',
    );
    expect(root.style.getPropertyValue('--cfm-consequence-text')).toBe(
      'rgb(4, 5, 6)',
    );
  });

  it('forwards the card overrides to the identity card', () => {
    const { container } = renderView({
      styles: { colors: { cardBackground: 'rgb(7, 8, 9)' } },
    });
    const card = container.querySelector('[style*="--rs-bg"]') as HTMLElement;

    expect(card.style.getPropertyValue('--rs-bg')).toBe('rgb(7, 8, 9)');
  });
});
