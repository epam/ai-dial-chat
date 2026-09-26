import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        id,
        value,
        onChange,
      }: {
        id?: string;
        value: string;
        onChange: (value: string) => void;
      }) => (
        <div>
          <textarea
            id={id}
            aria-label="Instructions"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button onClick={() => onChange(value + '**bold**')}>Bold</button>
        </div>
      ),
    }),
}));
const deferred = () => {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const group = (name: string) =>
  within(screen.getByRole('group', { name: new RegExp('^' + name) }));
const action = (name = 'Description') =>
  group(name).getByRole<HTMLButtonElement>('button', {
    name: 'Refine with AI',
  });
const field = (name = 'Description') =>
  screen.getByRole<HTMLTextAreaElement>('textbox', {
    name: new RegExp('^' + name),
  });
import type { SkillEditorProps } from '../../../models/skill-editor-props';
import { SkillEditor } from '../SkillEditor';
vi.mock('@epam/ai-dial-react-file-manager', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DialFoldersTree: () => null,
}));
const initialValues = {
  name: 'skill',
  description: 'Original',
  instructions: 'Original instructions',
};
const Harness = ({
  onSubmit = vi.fn(),
  ...props
}: Partial<SkillEditorProps>) => (
  <SkillEditor
    title="Skill"
    backAriaLabel="Back"
    onBack={vi.fn()}
    onCancel={vi.fn()}
    files={[]}
    fileActions={{
      validateBatch: vi.fn(),
      commitBatch: vi.fn(),
      onRemoveNode: vi.fn(),
    }}
    initialValues={initialValues}
    {...props}
    labels={{ createLabel: 'Save', ...props.labels }}
    onSubmit={onSubmit}
  />
);

describe('text refinement authoring', () => {
  it('is opt-in per field and disables whitespace', async () => {
    const { rerender } = render(<Harness />);
    await screen.findByRole('textbox', { name: 'Instructions' });
    expect(screen.queryByRole('button', { name: 'Refine with AI' })).toBeNull();
    rerender(<Harness onRefineDescription={vi.fn()} />);
    expect(
      screen.getAllByRole('button', { name: 'Refine with AI' }),
    ).toHaveLength(1);
    fireEvent.change(field(), { target: { value: '  ' } });
    expect(action().disabled).toBe(true);
  });
  it('refines twice, preserves the first baseline, restores focus on Undo, and saves restored text', async () => {
    const refine = vi
      .fn()
      .mockResolvedValueOnce('Better')
      .mockResolvedValueOnce('Best');
    const submit = vi.fn();
    render(<Harness onRefineDescription={refine} onSubmit={submit} />);
    await userEvent.click(action());
    expect(field().value).toBe('Better');
    await userEvent.click(action());
    expect(field().value).toBe('Best');
    expect(refine.mock.calls[1][0]).toBe('Better');
    await userEvent.click(
      group('Description').getByRole('button', { name: 'Undo' }),
    );
    expect(field().value).toBe('Original');
    /* Focus and inherited ARIA/direction/layout hooks have no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(action());
    expect(group('Description').getByRole('status').textContent).toContain(
      'Original text restored.',
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Original' }),
    );
  });
  it('coordinates both actions and Save, keeps fields editable, and preserves sibling edits', async () => {
    const pending = deferred();
    const refine = vi.fn<
      (value: string, signal: AbortSignal) => Promise<string>
    >(() => pending.promise);
    const other = vi.fn();
    const submit = vi.fn();
    render(
      <Harness
        onRefineDescription={refine}
        onRefineInstructions={other}
        onSubmit={submit}
      />,
    );
    await screen.findByRole('textbox', { name: 'Instructions' });
    fireEvent.click(action());
    fireEvent.click(action());
    expect(refine).toHaveBeenCalledTimes(1);
    expect(action('Instructions').disabled).toBe(true);
    for (const save of screen.getAllByRole<HTMLButtonElement>('button', {
      name: 'Save',
    })) {
      expect(save.disabled).toBe(true);
      fireEvent.click(save);
    }
    expect(submit).not.toHaveBeenCalled();
    expect(field().readOnly).toBe(false);
    expect(field('Instructions').readOnly).toBe(false);
    /* Focus and inherited ARIA/direction/layout hooks have no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(field().closest('[aria-busy]')?.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(group('Description').getByRole('status').textContent).toContain(
      'Refining text',
    );
    fireEvent.change(field('Instructions'), {
      target: { value: 'Sibling edited' },
    });
    await act(async () => pending.resolve('Refined'));
    expect(field().value).toBe('Refined');
    expect(field('Instructions').value).toBe('Sibling edited');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Refined' }),
    );
  });
  it.each(['Description', 'Instructions'])(
    'manual edits invalidate %s and ignore a late result',
    async (name) => {
      const pending = deferred();
      const refine = vi.fn<
        (value: string, signal: AbortSignal) => Promise<string>
      >(() => pending.promise);
      render(
        <Harness onRefineDescription={refine} onRefineInstructions={refine} />,
      );
      await screen.findByRole('textbox', { name: 'Instructions' });
      await userEvent.click(action(name));
      fireEvent.change(field(name), { target: { value: 'Manual' } });
      expect(refine.mock.calls[0][1].aborted).toBe(true);
      await act(async () => pending.resolve('Late'));
      expect(field(name).value).toBe('Manual');
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    },
  );
  it('a toolbar edit cancels instructions, and each field keeps its own Undo', async () => {
    const pending = deferred();
    const refine = vi
      .fn()
      .mockResolvedValueOnce('Better instructions')
      .mockImplementationOnce(() => pending.promise);
    render(
      <Harness
        onRefineDescription={async () => 'Better description'}
        onRefineInstructions={refine}
      />,
    );
    await screen.findByRole('textbox', { name: 'Instructions' });
    await userEvent.click(action());
    await userEvent.click(action('Instructions'));
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
    await userEvent.click(action('Instructions'));
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(refine.mock.calls[1][1].aborted).toBe(true);
    await act(async () => pending.resolve('Late'));
    expect(field('Instructions').value).toBe('Better instructions**bold**');
    expect(
      group('Description').getByRole<HTMLButtonElement>('button', {
        name: 'Undo',
      }).disabled,
    ).toBe(false);
  });
  it('shows inline retryable errors, retains text and baseline, and announces no-change', async () => {
    const refine = vi
      .fn()
      .mockResolvedValueOnce('Better')
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValueOnce('Better');
    render(<Harness onRefineDescription={refine} />);
    await userEvent.click(action());
    await userEvent.click(action());
    expect(field().value).toBe('Better');
    expect(
      group('Description').getByText(
        'Could not refine this text. Please try again.',
      ).textContent,
    ).toContain('Could not refine this text. Please try again.');
    expect(
      screen
        .getByRole('group', { name: /^Description/ })
        .getAttribute('aria-describedby'),
    ).toBe(
      group('Description').getByText(
        'Could not refine this text. Please try again.',
      ).id,
    );
    await userEvent.click(action());
    expect(group('Description').getByRole('status').textContent).toContain(
      'No changes were needed.',
    );
    await userEvent.click(
      group('Description').getByRole('button', { name: 'Undo' }),
    );
    expect(field().value).toBe('Original');
  });
  it.each(['Cancel', 'Back', 'unmount'])('cancels on %s', async (mode) => {
    const pending = deferred();
    const refine = vi.fn<
      (value: string, signal: AbortSignal) => Promise<string>
    >(() => pending.promise);
    const { unmount } = render(<Harness onRefineDescription={refine} />);
    await userEvent.click(action());
    if (mode === 'unmount') unmount();
    else
      await userEvent.click(screen.getAllByRole('button', { name: mode })[0]);
    expect(refine.mock.calls[0][1].aborted).toBe(true);
    await act(async () => pending.resolve('Late'));
  });
  it('supports supplied Arabic labels, RTL, keyboard activation and public styles', async () => {
    const refine = vi.fn(async () => '\u0645\u062d\u0633\u0646');
    const { container } = render(
      <div dir="rtl">
        <Harness
          onRefineDescription={refine}
          labels={{
            refineWithAiLabel:
              '\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u0646\u0635 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
            refineUndoLabel: '\u062a\u0631\u0627\u062c\u0639',
            refineSuccessAriaLabel:
              '\u062a\u0645 \u0627\u0644\u062a\u062d\u0633\u064a\u0646',
          }}
          styles={{
            colors: { refineActionText: '#111111', refineErrorText: '#880000' },
            typography: {
              refineFeedbackClassName: 'custom-feedback',
            },
          }}
        />
      </div>,
    );
    const button = screen.getByRole('button', {
      name: '\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u0646\u0635 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(refine).toHaveBeenCalledTimes(1);
    expect(group('Description').getByRole('status').textContent).toContain(
      '\u062a\u0645 \u0627\u0644\u062a\u062d\u0633\u064a\u0646',
    );
    /* Focus and inherited ARIA/direction/layout hooks have no semantic query. */
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    /* Focus and inherited ARIA/direction/layout hooks have no semantic query. */
    expect(button.parentElement?.className).toContain('ms-auto');
    // eslint-disable-next-line testing-library/no-node-access
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('draft replacement', () => {
  it('cancels an equal-text draft replacement and clears Undo', async () => {
    const pending = deferred();
    const refine = vi.fn<
      (value: string, signal: AbortSignal) => Promise<string>
    >(() => pending.promise);
    const { rerender } = render(
      <Harness onRefineDescription={refine} initialValues={initialValues} />,
    );
    await userEvent.click(action());
    rerender(
      <Harness
        onRefineDescription={refine}
        initialValues={{ ...initialValues }}
      />,
    );
    expect(refine.mock.calls[0][1].aborted).toBe(true);
    await act(async () => pending.resolve('Late'));
    expect(field().value).toBe('Original');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
  it('clears the baseline after manual edits and starts a new Undo session', async () => {
    const refine = vi
      .fn()
      .mockResolvedValueOnce('Better')
      .mockResolvedValueOnce('Newest');
    render(<Harness onRefineDescription={refine} />);
    await userEvent.click(action());
    fireEvent.change(field(), { target: { value: 'Manual baseline' } });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await userEvent.click(action());
    await userEvent.click(
      group('Description').getByRole('button', { name: 'Undo' }),
    );
    expect(field().value).toBe('Manual baseline');
  });
});
