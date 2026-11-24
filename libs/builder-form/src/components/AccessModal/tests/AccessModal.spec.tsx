import { AccessLevel } from '@epam/ai-dial-chat-shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCESS_FIELD_LABELS } from '../../../constants/access';
import {
  type AccessContentOption,
  type AccessEntry,
} from '../../../models/access';
import { AccessModal } from '../AccessModal';

const options: AccessContentOption[] = [
  {
    id: 'a',
    label: 'Alpha',
    allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
  },
  {
    id: 'b',
    label: 'Beta',
    allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
  },
  { id: 'c', label: 'Gamma', allowedAccess: [AccessLevel.Read] },
];

const user = userEvent.setup({ delay: null });

const renderModal = (
  value: AccessEntry[] = [],
  handlers: { onSave?: () => void; onClose?: () => void } = {},
) => {
  const onSave = vi.fn(handlers.onSave);
  const onClose = vi.fn(handlers.onClose);
  render(
    <AccessModal
      open
      value={value}
      contentOptions={options}
      labels={DEFAULT_ACCESS_FIELD_LABELS}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
};

const cards = () => screen.getAllByRole('group');
const contentSelect = (card: HTMLElement) =>
  within(card).getByRole('combobox', { name: 'Select content' });
const accessSelect = (card: HTMLElement) =>
  within(card).getByRole('combobox', { name: 'Select access' });

const choose = async (select: HTMLElement, optionName: string) => {
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: optionName }));
};

describe('AccessModal', () => {
  beforeEach(() => {
    /* jsdom has no IntersectionObserver; the kit dropdown list observes its items. */
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with a single empty card when there are no entries', () => {
    renderModal();
    expect(cards()).toHaveLength(1);
  });

  it('shows one card per entry plus a trailing empty card', () => {
    renderModal([
      { contentId: 'a', level: AccessLevel.Read },
      { contentId: 'b', level: AccessLevel.ReadWrite },
    ]);
    expect(cards()).toHaveLength(3);
  });

  it('adds a new empty card after the last card is filled in', async () => {
    renderModal();
    const [first] = cards();
    await choose(contentSelect(first), 'Alpha');
    expect(cards()).toHaveLength(1);
    await choose(accessSelect(first), 'Read');
    expect(cards()).toHaveLength(2);
  });

  it('saves exactly the filled-in cards and does not save the trailing card', async () => {
    const { onSave } = renderModal();
    let [card] = cards();
    await choose(contentSelect(card), 'Alpha');
    await choose(accessSelect(card), 'Read&Write');
    card = cards()[1];
    await choose(contentSelect(card), 'Gamma');
    await choose(accessSelect(card), 'Read');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { contentId: 'a', level: AccessLevel.ReadWrite },
      { contentId: 'c', level: AccessLevel.Read },
    ]);
  });

  it('drops a card with only content chosen on save', async () => {
    const { onSave } = renderModal([
      { contentId: 'a', level: AccessLevel.Read },
    ]);
    await choose(contentSelect(cards()[1]), 'Beta');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { contentId: 'a', level: AccessLevel.Read },
    ]);
  });

  it('offers only the allowed access of the chosen content', async () => {
    renderModal();
    const [card] = cards();
    await choose(contentSelect(card), 'Gamma');
    await user.click(accessSelect(card));
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toEqual(['Read']);
  });

  it('offers read and write for content that allows both', async () => {
    renderModal();
    const [card] = cards();
    await choose(contentSelect(card), 'Alpha');
    await user.click(accessSelect(card));
    expect(
      (await screen.findAllByRole('option')).map((o) => o.textContent),
    ).toEqual(['Read', 'Read&Write']);
  });

  it('disables content already chosen in another card', async () => {
    renderModal([{ contentId: 'a', level: AccessLevel.Read }]);
    await user.click(contentSelect(cards()[1]));
    const alpha = await screen.findByRole('option', { name: 'Alpha' });
    expect(alpha.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen
        .getByRole('option', { name: 'Beta' })
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('resets access to read when the content no longer allows it', async () => {
    const { onSave } = renderModal([
      { contentId: 'a', level: AccessLevel.ReadWrite },
    ]);
    await choose(contentSelect(cards()[0]), 'Gamma');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { contentId: 'c', level: AccessLevel.Read },
    ]);
  });

  it('keeps the access when the new content allows it', async () => {
    const { onSave } = renderModal([
      { contentId: 'a', level: AccessLevel.ReadWrite },
    ]);
    await choose(contentSelect(cards()[0]), 'Beta');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { contentId: 'b', level: AccessLevel.ReadWrite },
    ]);
  });

  it('removes a filled card with its delete button', async () => {
    const { onSave } = renderModal([
      { contentId: 'a', level: AccessLevel.Read },
      { contentId: 'b', level: AccessLevel.Read },
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Delete access 1: Alpha' }),
    );
    expect(cards()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { contentId: 'b', level: AccessLevel.Read },
    ]);
  });

  it('does nothing when the trailing empty card is deleted', async () => {
    renderModal([{ contentId: 'a', level: AccessLevel.Read }]);
    const before = cards();

    await user.click(screen.getByRole('button', { name: 'Delete access 2' }));

    expect(cards()).toEqual(before);
  });

  it('names a filled card and its delete button after the chosen content', () => {
    renderModal([{ contentId: 'b', level: AccessLevel.Read }]);

    expect(screen.getByRole('group', { name: 'Access 1: Beta' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Delete access 1: Beta' }),
    ).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Access 2' })).toBeTruthy();
  });

  it('keeps the draft when the author clicks outside the modal', async () => {
    const { onClose } = renderModal();
    await choose(contentSelect(cards()[0]), 'Alpha');

    await user.click(document.body);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('discards the draft on Cancel', async () => {
    const { onSave, onClose } = renderModal();
    await choose(contentSelect(cards()[0]), 'Alpha');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('discards the draft through the close control', async () => {
    const { onSave, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('discards the draft on Escape', async () => {
    const { onSave, onClose } = renderModal();
    await choose(contentSelect(cards()[0]), 'Alpha');

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('restarts the draft from the value each time it opens', async () => {
    const Host = () => {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <>
          <button onClick={() => setIsOpen(true)}>reopen</button>
          <AccessModal
            open={isOpen}
            value={[]}
            contentOptions={options}
            labels={DEFAULT_ACCESS_FIELD_LABELS}
            onSave={vi.fn()}
            onClose={() => setIsOpen(false)}
          />
        </>
      );
    };
    render(<Host />);
    await choose(contentSelect(cards()[0]), 'Alpha');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'reopen' }));

    expect(cards()).toHaveLength(1);
    expect(
      within(cards()[0]).getByRole<HTMLInputElement>('combobox', {
        name: 'Select content',
      }).value,
    ).not.toContain('Alpha');
  });

  it('uses the supplied labels', () => {
    render(
      <AccessModal
        open
        value={[]}
        contentOptions={options}
        labels={{
          ...DEFAULT_ACCESS_FIELD_LABELS,
          modalTitle: 'Zugriff',
          saveLabel: 'Speichern',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Zugriff' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
  });
});
