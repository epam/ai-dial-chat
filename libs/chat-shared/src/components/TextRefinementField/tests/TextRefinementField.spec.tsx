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
    expect(
      group.queryByRole('button', { name: 'Restore original' }),
    ).toBeNull();
  });

  it('disables the actions while the host blocks refinement', () => {
    renderField(makeRefinement({ canUndo: true }), true, true);

    for (const button of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }
  });

  it('offers Restore original and Regenerate instead of Refine with AI after a result', async () => {
    const refinement = makeRefinement({
      state: TextRefinementState.Success,
      canUndo: true,
    });
    renderField(refinement);

    expect(screen.queryByRole('button', { name: 'Refine with AI' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(refinement.refine).toHaveBeenCalledOnce();
  });

  it('announces success without showing it visually', () => {
    renderField(
      makeRefinement({ state: TextRefinementState.Success, canUndo: true }),
    );

    const status = within(screen.getByRole('status'));
    expect(status.getByText('Text refined').className).toContain('sr-only');
  });

  it('restores the original and focuses the main action, which reads Refine with AI again', async () => {
    const refinement = makeRefinement({
      state: TextRefinementState.Success,
      canUndo: true,
    });
    const { rerender } = renderField(refinement);

    await userEvent.click(
      screen.getByRole('button', { name: 'Restore original' }),
    );
    expect(refinement.undo).toHaveBeenCalledOnce();
    const main = screen.getByRole('button', { name: 'Regenerate' });
    /* Focus has no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(main);

    rerender(
      <TextRefinementField
        isEnabled
        fieldId="description"
        label="Description"
        refinement={makeRefinement({ state: TextRefinementState.Restored })}
        disabled={false}
      >
        <textarea id="description" />
      </TextRefinementField>,
    );
    expect(screen.getByRole('button', { name: 'Refine with AI' })).toBe(main);
    expect(
      within(screen.getByRole('status')).getByText('Original text restored.')
        .className,
    ).toContain('sr-only');
  });

  it('shows Refining on a disabled action and announces it without showing it visually', () => {
    renderField(
      makeRefinement({
        state: TextRefinementState.Pending,
        isPending: true,
        canRefine: false,
        canUndo: true,
      }),
    );

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Refining' })
        .disabled,
    ).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'Restore original' }),
    ).toBeNull();
    const status = within(screen.getByRole('status'));
    expect(status.getByText('Refining text').className).toContain('sr-only');
  });

  it('makes the field read-only while pending and gives it back afterwards', () => {
    const { rerender } = renderField(
      makeRefinement({ state: TextRefinementState.Pending, isPending: true }),
    );
    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Description',
    });
    expect(textbox.readOnly).toBe(true);

    for (const state of [
      TextRefinementState.Success,
      TextRefinementState.Error,
      TextRefinementState.Idle,
    ]) {
      rerender(
        <TextRefinementField
          isEnabled
          fieldId="description"
          label="Description"
          refinement={makeRefinement({ state, isPending: true })}
          disabled={false}
        >
          <textarea id="description" />
        </TextRefinementField>,
      );
      expect(textbox.readOnly).toBe(true);
      rerender(
        <TextRefinementField
          isEnabled
          fieldId="description"
          label="Description"
          refinement={makeRefinement({ state })}
          disabled={false}
        >
          <textarea id="description" />
        </TextRefinementField>,
      );
      expect(textbox.readOnly).toBe(false);
    }
  });

  it('leaves a field the host made read-only read-only after the request', () => {
    const renderPending = (isPending: boolean) => (
      <TextRefinementField
        isEnabled
        fieldId="description"
        label="Description"
        refinement={makeRefinement({ isPending })}
        disabled={false}
      >
        <textarea id="description" readOnly />
      </TextRefinementField>
    );
    const { rerender } = render(renderPending(true));
    rerender(renderPending(false));

    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' })
        .readOnly,
    ).toBe(true);
  });

  it('keeps the no-change status visible', () => {
    renderField(makeRefinement({ state: TextRefinementState.Unchanged }));

    const status = within(screen.getByRole('status'));
    expect(status.getByText('No changes were needed.').className).not.toContain(
      'sr-only',
    );
  });

  it('renders the caption outside the status region when refinement is enabled', () => {
    render(
      <TextRefinementField
        isEnabled
        fieldId="description"
        label="Description"
        refinement={makeRefinement({ state: TextRefinementState.Success })}
        disabled={false}
        caption="0/500"
      >
        <textarea id="description" />
      </TextRefinementField>,
    );

    expect(screen.getByText('0/500')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Text refined');
  });

  it('renders the caption when the host disables refinement', () => {
    render(
      <TextRefinementField
        isEnabled={false}
        fieldId="description"
        label="Description"
        refinement={makeRefinement()}
        disabled={false}
        caption="0/500"
      >
        <textarea id="description" />
      </TextRefinementField>,
    );

    expect(screen.getByText('0/500')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the error as text that describes the group', () => {
    renderField(makeRefinement({ state: TextRefinementState.Error }));

    const error = screen.getByText(
      'Could not refine this text. Please try again.',
    );
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(
      error.id,
    );
  });

  it('mounts an empty status region before any refinement starts', () => {
    renderField(makeRefinement());
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('announces the error through an alert region mounted before the failure', () => {
    const { rerender } = renderField(makeRefinement());
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('');

    rerender(
      <TextRefinementField
        isEnabled
        fieldId="description"
        label="Description"
        refinement={makeRefinement({ state: TextRefinementState.Error })}
        disabled={false}
      >
        <textarea id="description" />
      </TextRefinementField>,
    );

    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.textContent).toBe(
      'Could not refine this text. Please try again.',
    );
  });
});
