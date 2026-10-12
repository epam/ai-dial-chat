import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeleteConfirmationView } from '../DeleteConfirmationView';

const renderView = (
  props?: Partial<Parameters<typeof DeleteConfirmationView>[0]>,
) =>
  render(
    <DeleteConfirmationView
      names={['report.pdf']}
      message="Are you sure?"
      {...props}
    />,
  );

describe('DeleteConfirmationView', () => {
  it('shows a single name in the identity card with no name list', () => {
    renderView({ icon: <svg aria-label="chat" /> });

    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByLabelText('chat')).toBeTruthy();
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('ends the consequences with the "cannot be undone" bullet', () => {
    renderView({ consequences: ['Users lose access'] });

    const bullets = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(bullets).toEqual(['Users lose access', 'Cannot be undone']);
  });

  it('counts a selection in the card and lists its names', () => {
    renderView({ names: ['a.pdf', 'b.pdf'], icon: <svg aria-label="chat" /> });

    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.queryByLabelText('chat')).toBeNull();
    const [nameList] = screen.getAllByRole('list');
    expect(
      within(nameList)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['a.pdf', 'b.pdf']);
  });

  it('collapses names past the cap into a "more" entry', () => {
    renderView({
      names: ['a', 'b', 'c', 'd'],
      maxListedNames: 2,
      labels: { moreItems: (count) => `+${count}` },
    });

    const [nameList] = screen.getAllByRole('list');
    expect(
      within(nameList)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['a', 'b', '+2']);
  });

  it('uses host labels', () => {
    renderView({
      names: ['a', 'b'],
      labels: {
        itemCount: (count) => `${count} éléments`,
        cannotBeUndone: 'Irréversible',
      },
    });

    expect(screen.getByText('2 éléments')).toBeTruthy();
    expect(screen.getByText('Irréversible')).toBeTruthy();
  });
});
