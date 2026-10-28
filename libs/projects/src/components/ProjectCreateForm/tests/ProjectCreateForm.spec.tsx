import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectCreateFormProps } from '../../../models/project-create-form-props';
import { ContextFileRejection } from '../../../types/context-file-rejection';
import { ProjectNameError } from '../../../types/project-name-error';
import { checkContextFiles } from '../../../utils/context-files';
import { ProjectCreateForm } from '../ProjectCreateForm';

const LIMITS = {
  allowedExtensions: ['csv', 'pdf', 'xlsx'],
  maxFileBytes: 1_048_576,
  maxTotalBytes: 10_485_760,
};

const makeFile = (name: string, size: number, type = '') =>
  new File([new Uint8Array(size)], name, { type });

const stageFiles = (files: File[]) =>
  checkContextFiles(files, [], LIMITS).accepted;

const LABELS: ProjectCreateFormProps['labels'] = {
  title: 'New project',
  backLabel: 'Back',
  cancelLabel: 'Cancel',
  createLabel: 'Create',
  nameLabel: 'Name',
  namePlaceholder: 'Enter project name',
  nameErrors: {
    [ProjectNameError.Required]: 'Name is required',
    [ProjectNameError.InvalidCharacters]: 'Name contains invalid characters',
    [ProjectNameError.Reserved]: 'This name is reserved',
    [ProjectNameError.TooLong]: 'Name is too long',
  },
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Describe what the project is about',
  instructionsLabel: 'Instructions',
  instructionsPlaceholder: 'Explain your reasoning step by step',
  contextLabel: 'Context',
  dropZoneLabel: 'Drag&drop context, upload from device or file manager',
  dropZoneHint: 'File formats .csv, .pdf and .xlsx (max 1 MB)',
  addLabel: 'Add',
  addFromDeviceLabel: 'Upload from device',
  addFromFileManagerLabel: 'From file manager',
  capacityMeterLabel: 'Context capacity',
  capacityLabel: (percent) => `${percent}% of capacity used`,
  removeFileLabel: (name) => `Remove ${name}`,
  fileRejections: {
    [ContextFileRejection.UnsupportedType]: (name) =>
      `${name}: unsupported file type`,
    [ContextFileRejection.TooLarge]: (name) => `${name}: file is too large`,
    [ContextFileRejection.CapacityExceeded]: (name) =>
      `${name}: not enough capacity`,
    [ContextFileRejection.Duplicate]: (name) => `${name}: already added`,
    [ContextFileRejection.InvalidName]: (name) => `${name}: invalid name`,
  },
  filesAddedStatus: (count) => `${count} files added`,
  fileRemovedStatus: (name) => `${name} removed`,
  creatingStatus: 'Creating project…',
  refinement: { refineWithAiLabel: 'Refine with AI', refineUndoLabel: 'Undo' },
};

vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        value,
        onChange,
        id,
        placeholder,
      }: {
        value: string;
        onChange: (value: string) => void;
        id?: string;
        placeholder?: string;
      }) => (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ),
    }),
}));

type FormProps = ProjectCreateFormProps;

const EMPTY_VALUES = { name: '', description: '', instructions: '' };

const renderForm = (overrides: Partial<FormProps> = {}) => {
  const props: FormProps = {
    values: EMPTY_VALUES,
    errors: {},
    onFieldChange: vi.fn(),
    contextFiles: [],
    onContextFilesChange: vi.fn(),
    ...LIMITS,
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
    labels: LABELS,
    ...overrides,
  };
  const utils = render(<ProjectCreateForm {...props} />);
  return { ...utils, props };
};

/* The header and the mobile footer both render the action pair; CSS shows
 * one at a time, so tests act on the first. */
const getCreateButton = () =>
  screen.getAllByRole('button', { name: 'Create' })[0];

const getDropzoneInput = () =>
  screen.getByLabelText(/Drag&drop context/) as HTMLInputElement;

/* Kit controls render their own status regions; the form's is the last one. */
const getFormStatus = () => screen.getAllByRole('status').at(-1) as HTMLElement;

describe('ProjectCreateForm', () => {
  describe('header', () => {
    it('renders the title as the page heading', () => {
      renderForm();

      expect(
        screen.getByRole('heading', { level: 1, name: 'New project' }),
      ).toBeTruthy();
    });

    it('disables Create until the name is valid', () => {
      const { rerender, props } = renderForm();
      expect(getCreateButton().hasAttribute('disabled')).toBe(true);

      rerender(
        <ProjectCreateForm
          {...props}
          values={{ ...EMPTY_VALUES, name: 'Handbook' }}
        />,
      );

      expect(getCreateButton().hasAttribute('disabled')).toBe(false);
    });

    it('calls onSubmit when Create is activated on a valid form', async () => {
      const { props } = renderForm({
        values: { ...EMPTY_VALUES, name: 'Handbook' },
      });

      await userEvent.click(getCreateButton());

      expect(props.onSubmit).toHaveBeenCalledOnce();
    });

    it('calls onBack and onCancel from the header actions', async () => {
      const { props } = renderForm();

      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      await userEvent.click(
        screen.getAllByRole('button', { name: 'Cancel' })[0],
      );

      expect(props.onBack).toHaveBeenCalledOnce();
      expect(props.onCancel).toHaveBeenCalledOnce();
    });

    it('blocks a second submission and announces it while submitting', async () => {
      const { props } = renderForm({
        values: { ...EMPTY_VALUES, name: 'Handbook' },
        isSubmitting: true,
      });

      await userEvent.click(getCreateButton());

      expect(props.onSubmit).not.toHaveBeenCalled();
      expect(getFormStatus().textContent).toBe('Creating project…');
    });
  });

  describe('name', () => {
    it('marks the name field as required', () => {
      renderForm();

      const input = screen.getByRole('textbox', { name: /Name/ });
      expect(input.getAttribute('aria-required')).toBe('true');
      expect(input.getAttribute('placeholder')).toBe('Enter project name');
    });

    it('shows the invalid-characters error after blur, linked to the field', async () => {
      renderForm({ values: { ...EMPTY_VALUES, name: 'Q4/launch' } });
      const input = screen.getByRole('textbox', { name: /Name/ });
      expect(screen.queryByText('Name contains invalid characters')).toBeNull();

      await userEvent.click(input);
      await userEvent.tab();

      const error = screen.getByText('Name contains invalid characters');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(error.id);
      expect(getCreateButton().hasAttribute('disabled')).toBe(true);
    });

    it('shows a host error as an alert linked to the field and focuses it', () => {
      renderForm({
        values: { ...EMPTY_VALUES, name: 'Handbook' },
        errors: { name: 'A project with this name already exists' },
      });

      const input = screen.getByRole('textbox', { name: /Name/ });
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('A project with this name already exists');
      expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    });

    it('moves focus to Name when the host reports a name error', async () => {
      const { props } = renderForm({
        values: { ...EMPTY_VALUES, name: 'Handbook' },
        errors: { name: 'A project with this name already exists' },
      });

      await userEvent.keyboard('x');

      expect(props.onFieldChange).toHaveBeenCalledWith('name', 'Handbookx');
    });

    it('reports typing through onFieldChange', async () => {
      const { props } = renderForm();

      await userEvent.type(screen.getByRole('textbox', { name: /Name/ }), 'a');

      expect(props.onFieldChange).toHaveBeenCalledWith('name', 'a');
    });
  });

  describe('context files', () => {
    it('adds a file picked through the drop zone upload button', async () => {
      const { props } = renderForm();
      const file = makeFile('tickets.csv', 200, 'text/csv');

      await userEvent.upload(getDropzoneInput(), file);

      expect(props.onContextFilesChange).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'tickets.csv', file }),
      ]);
      expect(getFormStatus().textContent).toBe('1 files added');
    });

    it('limits the pickers to the allowed extensions', () => {
      renderForm();

      expect(getDropzoneInput().getAttribute('accept')).toBe('.csv,.pdf,.xlsx');
    });

    it('adds files picked from the file manager through the Add menu', async () => {
      const file = makeFile('survey.xlsx', 100);
      const onPickFromFileManager = vi.fn().mockResolvedValue([file]);
      const { props } = renderForm({ onPickFromFileManager });

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'From file manager' }),
      );

      await waitFor(() =>
        expect(props.onContextFilesChange).toHaveBeenCalledWith([
          expect.objectContaining({ name: 'survey.xlsx', file }),
        ]),
      );
    });

    it('hides the file manager source when the host offers none', async () => {
      renderForm();

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(
        await screen.findByRole('menuitem', { name: 'Upload from device' }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('menuitem', { name: 'From file manager' }),
      ).toBeNull();
    });

    it('lists and announces files the client rejects', async () => {
      const onPickFromFileManager = vi
        .fn()
        .mockResolvedValue([
          makeFile('notes.docx', 10),
          makeFile('big.pdf', 2 * 1_048_576),
        ]);
      const { props } = renderForm({ onPickFromFileManager });

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'From file manager' }),
      );

      expect(
        await screen.findByText('notes.docx: unsupported file type'),
      ).toBeTruthy();
      expect(screen.getByText('big.pdf: file is too large')).toBeTruthy();
      expect(getFormStatus().textContent).toContain(
        'notes.docx: unsupported file type',
      );
      expect(props.onContextFilesChange).not.toHaveBeenCalled();
    });

    it('rejects a file that would overflow the capacity', async () => {
      const existing = stageFiles([
        makeFile('a.csv', 1_000_000),
        makeFile('b.csv', 1_000_000),
      ]);
      const { props } = renderForm({
        contextFiles: existing,
        maxTotalBytes: 2_500_000,
      });

      await userEvent.upload(getDropzoneInput(), makeFile('c.csv', 800_000));

      expect(
        screen.getByText('c.csv: not enough capacity', { selector: 'li' }),
      ).toBeTruthy();
      expect(props.onContextFilesChange).not.toHaveBeenCalled();
    });

    it('renders a card per file with a named remove button', async () => {
      const files = stageFiles([makeFile('tickets.csv', 10)]);
      const { props } = renderForm({ contextFiles: files });

      await userEvent.click(
        screen.getByRole('button', { name: 'Remove tickets.csv' }),
      );

      expect(props.onContextFilesChange).toHaveBeenCalledWith([]);
      expect(getFormStatus().textContent).toBe('tickets.csv removed');
    });

    it('shows the capacity meter only once a file is added', () => {
      const { rerender, props } = renderForm();
      expect(screen.queryByRole('meter')).toBeNull();

      rerender(
        <ProjectCreateForm
          {...props}
          contextFiles={stageFiles([makeFile('a.csv', 1_048_576)])}
        />,
      );

      expect(
        screen
          .getByRole('meter', { name: 'Context capacity' })
          .getAttribute('aria-valuetext'),
      ).toBe('10% of capacity used');
    });

    it('shows a host context error as an alert', () => {
      renderForm({ errors: { context: 'Some files were rejected' } });

      expect(screen.getByRole('alert').textContent).toBe(
        'Some files were rejected',
      );
    });
  });

  describe('refinement', () => {
    it('hides Refine with AI when no callback is supplied', () => {
      renderForm();

      expect(
        screen.queryByRole('button', { name: /Refine with AI/ }),
      ).toBeNull();
    });

    it('refines the description and offers undo', async () => {
      const onRefineDescription = vi.fn().mockResolvedValue('Refined text');
      const { props } = renderForm({
        values: { ...EMPTY_VALUES, description: 'draft' },
        onRefineDescription,
      });

      await userEvent.click(
        screen.getByRole('button', { name: /Refine with AI/ }),
      );

      await waitFor(() =>
        expect(props.onFieldChange).toHaveBeenCalledWith(
          'description',
          'Refined text',
        ),
      );
      expect(onRefineDescription).toHaveBeenCalledWith(
        'draft',
        expect.any(AbortSignal),
      );
    });

    it('refines the instructions through onFieldChange', async () => {
      const onRefineInstructions = vi.fn().mockResolvedValue('## Steps');
      const { props } = renderForm({
        values: { ...EMPTY_VALUES, instructions: 'steps' },
        onRefineInstructions,
      });

      await userEvent.click(
        screen.getByRole('button', { name: /Refine with AI/ }),
      );

      await waitFor(() =>
        expect(props.onFieldChange).toHaveBeenCalledWith(
          'instructions',
          '## Steps',
        ),
      );
    });

    it('disables Create and the other action while a refinement is pending', async () => {
      const onRefineDescription = vi.fn(
        () => new Promise<string>(() => undefined),
      );
      renderForm({
        values: { name: 'Handbook', description: 'draft', instructions: 'x' },
        onRefineDescription,
        onRefineInstructions: vi.fn(),
      });

      const [descriptionAction] = screen.getAllByRole('button', {
        name: /Refine with AI/,
      });
      await userEvent.click(descriptionAction);

      await waitFor(() =>
        expect(getCreateButton().hasAttribute('disabled')).toBe(true),
      );
      const remaining = screen
        .queryAllByRole('button', { name: /Refine with AI/ })
        .filter((button) => !button.hasAttribute('disabled'));
      expect(remaining).toHaveLength(0);
    });
  });
});

describe('ProjectCreateForm — layout', () => {
  it('uses no physical-direction utility classes', () => {
    const source = readFileSync(
      join(__dirname, '../ProjectCreateForm.tsx'),
      'utf-8',
    );

    expect(source).not.toMatch(
      /\b(ml|mr|pl|pr|left|right)-\d|text-(left|right)\b|border-[lr]-/,
    );
    expect(source).not.toMatch(/\b(sm|md|lg|xl):/);
  });

  it('renders every file card as an item of one list', () => {
    const files = stageFiles([makeFile('a.csv', 1), makeFile('b.csv', 1)]);
    renderForm({ contextFiles: files });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('wraps the file cards and mirrors the back arrow in RTL', () => {
    const source = readFileSync(
      join(__dirname, '../ProjectCreateForm.tsx'),
      'utf-8',
    );

    expect(source).toContain('flex min-w-0 flex-wrap gap-2');
    expect(source).toContain('rtl:scale-x-[-1]');
  });
});

describe('@epam/ai-dial-projects — library isolation', () => {
  const listSources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === 'tests' ? [] : listSources(path);
      }
      return /\.tsx?$/.test(entry.name) && !entry.name.includes('.spec.')
        ? [path]
        : [];
    });

  it('contains no host integration knowledge in any lib source file', () => {
    const sources = listSources(join(__dirname, '../../..'));
    expect(sources.some((file) => file.endsWith('ProjectCreateForm.tsx'))).toBe(
      true,
    );
    const offenders = sources.filter((file) =>
      /['"`]\/api\/|@epam\/ai-dial-chat-api-client|react-i18next|react-router|useFeatureFlag|server-api|apps\/chat|localStorage|process\.env/.test(
        readFileSync(file, 'utf-8'),
      ),
    );

    expect(offenders).toEqual([]);
  });
});
