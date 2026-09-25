import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  SendOnEnter,
  type CommandMenuConfig,
  type CommandMenuContext,
} from '../../../models/Input';
import { Input } from '../Input';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    /*
     * The real Dropdown renders its overlay through a FloatingPortal, so it
     * lands outside the caret-anchored `aria-hidden` wrapper this component
     * places around Dropdown's zero-size reference element. Rendering the
     * overlay via `createPortal` here (instead of inline as a child) keeps
     * that same escape so the mock doesn't hide the menu from the
     * accessibility tree.
     */
    Dropdown: ({
      children,
      open,
      renderOverlay,
    }: {
      children: ReactNode;
      open?: boolean;
      renderOverlay?: () => ReactNode;
    }) => (
      <div>
        {children}
        {open &&
          renderOverlay &&
          createPortal(renderOverlay(), document.body)}
      </div>
    ),
  };
});

const OPTIONS = ['alpha', 'beta', 'gamma'];

/*
 * A minimal host menu honoring the `CommandMenuContext` contract: a listbox
 * under `listboxId`, one option per matching name, `aria-selected` on the
 * active one, and selection through the option's `onClick`.
 */
const buildCommandMenu = (
  onSelect: (name: string) => void,
): CommandMenuConfig => ({
  triggerPrefix: '/',
  menuLabel: 'Skills',
  renderMenu: ({
    query,
    close,
    listboxId,
    activeOptionId,
  }: CommandMenuContext) => (
    <ul role="listbox" id={listboxId} aria-label="Skills list">
      {OPTIONS.filter((name) => name.includes(query)).map((name) => {
        const id = `${listboxId}-${name}`;
        return (
          /* The keyboard reaches options through the textarea, not through key listeners on the option. */
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={name}
            role="option"
            id={id}
            aria-selected={id === activeOptionId}
            onClick={() => {
              close({ consumeQuery: true });
              onSelect(name);
            }}
          >
            {name}
          </li>
        );
      })}
    </ul>
  ),
});

const renderWithMenu = (sendOnEnter?: SendOnEnter) => {
  const onSend = vi.fn();
  const onSelect = vi.fn();
  render(
    <Input
      onSend={onSend}
      sendOnEnter={sendOnEnter}
      commandMenu={buildCommandMenu(onSelect)}
      messageHistory={['previous message']}
    />,
  );
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { onSend, onSelect, textarea };
};

const openMenu = (textarea: HTMLTextAreaElement, query = '') => {
  fireEvent.change(textarea, { target: { value: '/' } });
  if (query !== '') {
    fireEvent.change(textarea, { target: { value: `/${query}` } });
  }
};

const getSelectedOptionNames = () =>
  screen
    .getAllByRole('option')
    .filter((option) => option.getAttribute('aria-selected') === 'true')
    .map((option) => option.textContent);

describe('Input — command menu keyboard navigation', () => {
  it('wires the textarea to the open menu as a list autocomplete', () => {
    const { textarea } = renderWithMenu();
    expect(textarea.getAttribute('aria-autocomplete')).toBe('list');
    expect(textarea.getAttribute('aria-controls')).toBeNull();

    openMenu(textarea);

    expect(textarea.getAttribute('aria-controls')).toBe(
      screen.getByRole('listbox').id,
    );
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull();
    expect(screen.getByRole('group', { name: 'Skills' })).toBeTruthy();
  });

  it('moves the active option with ArrowDown/ArrowUp, wrapping at both ends', () => {
    const { textarea } = renderWithMenu();
    openMenu(textarea);

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    expect(getSelectedOptionNames()).toEqual(['alpha']);
    expect(textarea.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'alpha' }).id,
    );

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    expect(getSelectedOptionNames()).toEqual(['gamma']);

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    expect(getSelectedOptionNames()).toEqual(['alpha']);

    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    expect(getSelectedOptionNames()).toEqual(['gamma']);
  });

  it('starts ArrowUp from the last option', () => {
    const { textarea } = renderWithMenu();
    openMenu(textarea);

    fireEvent.keyDown(textarea, { key: 'ArrowUp' });

    expect(getSelectedOptionNames()).toEqual(['gamma']);
  });

  it('keeps the arrows away from message history while the menu is open', () => {
    const { textarea } = renderWithMenu();
    openMenu(textarea, 'a');

    fireEvent.keyDown(textarea, { key: 'ArrowUp' });

    expect(textarea.value).toBe('/a');
  });

  it('takes the active option on Enter, consuming the query without sending', () => {
    const { textarea, onSend, onSelect } = renderWithMenu();
    openMenu(textarea, 'b');

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('beta');
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
    expect(screen.getByRole('textbox')).toBe(document.activeElement);
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('does nothing on Enter while no option is active', () => {
    const { textarea, onSend, onSelect } = renderWithMenu();
    openMenu(textarea, 'a');

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(textarea.value).toBe('/a');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('blocks the MetaEnter send gesture while the menu is open', () => {
    const { textarea, onSend } = renderWithMenu(SendOnEnter.MetaEnter);
    openMenu(textarea, 'a');

    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('/a');
  });

  it('clears the active option when the query changes', () => {
    const { textarea } = renderWithMenu();
    openMenu(textarea, 'a');
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });

    fireEvent.change(textarea, { target: { value: '/al' } });

    expect(getSelectedOptionNames()).toEqual([]);
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('keeps mouse selection working', async () => {
    const { textarea, onSend, onSelect } = renderWithMenu();
    openMenu(textarea);

    await userEvent.click(screen.getByRole('option', { name: 'gamma' }));

    expect(onSelect).toHaveBeenCalledWith('gamma');
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('');
  });

  it('keeps Enter sending and the arrows navigating history with no menu open', () => {
    const { textarea, onSend } = renderWithMenu();

    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    expect(textarea.value).toBe('previous message');

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('previous message', []);
  });
});
