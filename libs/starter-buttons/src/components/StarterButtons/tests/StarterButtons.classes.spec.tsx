import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STARTER_BUTTONS_CLASS } from '../../../constants/public-class-names';
import { StarterButtons } from '../StarterButtons';

/*
 * The public class names are this package's styling contract. A lost class
 * fails silently: the build passes and a host's stylesheet simply stops
 * applying, which is why it is asserted here rather than left to review.
 *
 * Each case locates the element by its role first, so a class that landed on
 * the wrong node cannot pass.
 */

const labels = { list: 'Conversation starters', overflow: 'More starters' };

const starters: StarterOption[] = [
  {
    const: 0,
    title: 'Starter 0',
    'dial:widgetOptions': {
      populateText: 'Prompt 0',
      submit: false,
      confirmationMessage: null,
    },
  },
];

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- an unlabeled container has no role or text to query, and querying by the class would pass with the class on the wrong node
  from.closest(`.${className}`);

describe('StarterButtons — public class names', () => {
  it('stamps the list and the wrapper around it', () => {
    render(
      <StarterButtons starters={starters} onSelect={vi.fn()} labels={labels} />,
    );

    const list = screen.getByRole('list', { name: labels.list });
    expect(list.classList).toContain(STARTER_BUTTONS_CLASS.list);
    expect(closestWithClass(list, STARTER_BUTTONS_CLASS.root)).toBeTruthy();
  });

  it('keeps both classes in the non-collapsible layout', () => {
    render(
      <StarterButtons
        starters={starters}
        onSelect={vi.fn()}
        isCollapsible={false}
        labels={labels}
      />,
    );

    const list = screen.getByRole('list', { name: labels.list });
    expect(list.classList).toContain(STARTER_BUTTONS_CLASS.list);
    expect(closestWithClass(list, STARTER_BUTTONS_CLASS.root)).toBeTruthy();
  });
});
