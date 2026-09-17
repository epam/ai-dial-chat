import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PROMPT_EDITOR_CLASS } from '../../../constants/public-class-names';
import { PromptFolderField } from '../PromptFolderField';

/*
 * The public class name is this package's styling contract, and a lost class
 * fails silently. The field's root carries no role, so the case locates the
 * folder control by role first and walks up to the stamped element.
 */

const FOLDERS = [{ id: 'f1', name: 'Folder 1' }];

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- an unlabeled container has no role or text to query, and querying by the class would pass with the class on the wrong node
  from.closest(`.${className}`);

describe('PromptFolderField — public class names', () => {
  it('stamps the field root', () => {
    render(<PromptFolderField value="" folders={FOLDERS} onChange={vi.fn()} />);

    const control = screen.getByRole('combobox', { name: 'Folder' });
    expect(
      closestWithClass(control, PROMPT_EDITOR_CLASS.folderField),
    ).toBeTruthy();
  });
});
