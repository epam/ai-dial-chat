import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PROMPT_EDITOR_CLASS } from '../../../constants/public-class-names';
import { PromptEditor } from '../PromptEditor';

/*
 * The public class names are this package's styling contract. A lost class
 * fails silently — the build passes and a host's stylesheet simply stops
 * applying — so it is asserted here rather than left to review.
 *
 * The form column carries no role of its own, so each case locates a control
 * inside it by role and then walks up: a class that landed on an unrelated
 * node cannot satisfy that.
 */

vi.mock('@epam/ai-dial-builder-form', () => ({
  EditorLayout: ({ leftContent }: { leftContent?: ReactNode }) => (
    <div>{leftContent}</div>
  ),
}));

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- an unlabeled container has no role or text to query, and querying by the class would pass with the class on the wrong node
  from.closest(`.${className}`);

describe('PromptEditor — public class names', () => {
  it('stamps the form column that holds the fields', () => {
    render(<PromptEditor onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const nameField = screen.getByRole('textbox', { name: /Name/ });
    expect(closestWithClass(nameField, PROMPT_EDITOR_CLASS.form)).toBeTruthy();
  });
});
