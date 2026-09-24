import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityEditorProps } from '../../../models/entity-editor-props';
import { EntityEditor } from '../EntityEditor';

const renderEditor = (props: Partial<EntityEditorProps> = {}) =>
  render(
    <EntityEditor
      title="Create toolset"
      onBack={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      submitLabel="Create"
      metadata={<p>metadata fields</p>}
      setup={<p>setup fields</p>}
      {...props}
    />,
  );

/* The section root has no role or text of its own, so the only way to reach it is to walk up. */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

/*
 * EditorLayout renders the actions twice — in the desktop header and in the
 * mobile bottom bar — and jsdom applies no media queries, so both copies are
 * in the DOM. Assertions take the first (header) copy.
 */
const getFirstButton = (name: string) =>
  screen.getAllByRole('button', { name })[0];

describe('EntityEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title heading and the Metadata and Setup sections with their content', () => {
    renderEditor();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Create toolset' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Metadata' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Setup' }),
    ).toBeTruthy();
    expect(screen.getByText('metadata fields')).toBeTruthy();
    expect(screen.getByText('setup fields')).toBeTruthy();
  });

  it('renders extra actions before Cancel and the primary button', () => {
    renderEditor({ extraActions: <button type="button">Preview</button> });

    // The back arrow is icon-only, so the labelled buttons in document order start with the header actions.
    const labelledButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter(Boolean);

    expect(labelledButtons.slice(0, 3)).toEqual([
      'Preview',
      'Cancel',
      'Create',
    ]);
  });

  it('calls onBack, onCancel and onSubmit from their buttons', async () => {
    const onBack = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    renderEditor({
      onBack,
      onCancel,
      onSubmit,
      labels: { backAriaLabel: 'Back to catalog' },
    });

    await user.click(screen.getByRole('button', { name: 'Back to catalog' }));
    await user.click(getFirstButton('Cancel'));
    await user.click(getFirstButton('Create'));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('shows only the extra actions when standard actions are hidden', () => {
    renderEditor({
      extraActions: <button type="button">Exit preview</button>,
      hideStandardActions: true,
    });

    expect(
      screen.getAllByRole('button', { name: 'Exit preview' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('renders no Setup section when setup is absent', () => {
    renderEditor({ setup: undefined });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Metadata' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Setup' }),
    ).toBeNull();
  });

  it('disables Cancel and the primary button while submitting', () => {
    renderEditor({ isSubmitting: true });

    expect((getFirstButton('Cancel') as HTMLButtonElement).disabled).toBe(true);
    expect((getFirstButton('Create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables only the primary button when submit is externally disabled', () => {
    renderEditor({ isSubmitDisabled: true });

    expect((getFirstButton('Cancel') as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((getFirstButton('Create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the primary button enabled by default', () => {
    renderEditor();

    expect((getFirstButton('Create') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('renders the alert content in an alert region', () => {
    renderEditor({ alert: 'Failed to create application' });

    expect(screen.getByRole('alert').textContent).toBe(
      'Failed to create application',
    );
  });

  it('uses setupTitle and custom labels over the defaults', () => {
    renderEditor({
      setupTitle: 'SKILL.md',
      labels: { metadataTitle: 'Metadaten', cancelLabel: 'Abbrechen' },
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'SKILL.md' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Metadaten' }),
    ).toBeTruthy();
    expect(getFirstButton('Abbrechen')).toBeTruthy();
  });

  it('stamps host-supplied classes on the section roots', () => {
    renderEditor({
      metadataSectionClassName: 'host-metadata',
      setupSectionClassName: 'host-setup',
    });

    expect(
      closestWithClass(screen.getByText('metadata fields'), 'host-metadata'),
    ).toBeTruthy();
    expect(
      closestWithClass(screen.getByText('setup fields'), 'host-setup'),
    ).toBeTruthy();
  });
});
