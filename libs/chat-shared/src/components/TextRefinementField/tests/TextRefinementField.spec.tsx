import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  TextRefinementState,
  type TextRefinementResult,
} from '../../../hooks/useTextRefinement';
import { TextRefinementField } from '../TextRefinementField';

const makeRefinement = (
  overrides: Partial<TextRefinementResult> = {},
): TextRefinementResult => ({
  state: TextRefinementState.Idle,
  isPending: false,
  canRefine: true,
  canUndo: false,
  refine: vi.fn(async () => undefined),
  undo: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

const renderField = (
  refinement: TextRefinementResult,
  isEnabled = true,
  disabled = false,
) =>
  render(
    <TextRefinementField
      isEnabled={isEnabled}
      fieldId="description"
      label="Description"
      refinement={refinement}
      disabled={disabled}
    >
      <textarea id="description" />
    </TextRefinementField>,
  );

describe('TextRefinementField', () => {
  it('renders only the field when the host disables refinement', () => {
    renderField(makeRefinement(), false);

    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('names the group and the field by the label and triggers refine', async () => {
    const refinement = makeRefinement();
    renderField(refinement);

    const group = within(screen.getByRole('group', { name: 'Description' }));
    expect(group.getByRole('textbox', { name: 'Description' })).toBeTruthy();
    await userEvent.click(
      group.getByRole('button', { name: 'Refine with AI' }),
    );
    expect(refinement.refine).toHaveBeenCalledOnce();
    expect(group.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('disables the actions while the host blocks refinement', () => {
    renderField(makeRefinement({ canUndo: true }), true, true);

    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
  });

  it('announces success and returns focus to Refine on Undo', async () => {
    const refinement = makeRefinement({
      state: TextRefinementState.Success,
      canUndo: true,
    });
    renderField(refinement);

    expect(screen.getByRole('status').textContent).toBe(
      'Text refined. Undo is available.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(refinement.undo).toHaveBeenCalledOnce();
    /* Focus has no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Refine with AI' }),
    );
  });

  it('shows the error as an alert that describes the group', () => {
    renderField(makeRefinement({ state: TextRefinementState.Error }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'Could not refine this text. Please try again.',
    );
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(
      alert.id,
    );
  });
});
