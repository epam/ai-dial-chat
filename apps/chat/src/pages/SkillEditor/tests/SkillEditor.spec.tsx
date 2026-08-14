import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUser } from '../../../context/auth/UserContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  createSkill,
  downloadSkill,
  updateSkill,
} from '../../../server-api/skills.api';
import SkillEditor from '../SkillEditor';

const buildSkillResponse = (
  manifest: string,
  etag: string | null = '"etag-1"',
  files: Record<string, string> = {},
): Response => {
  const zipped = zipSync({
    'SKILL.md': strToU8(manifest),
    ...Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
    ),
  });
  return {
    headers: { get: (key: string) => (key === 'etag' ? etag : null) },
    arrayBuffer: () => Promise.resolve(new Uint8Array(zipped).buffer),
  } as unknown as Response;
};

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: vi.fn(),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../hooks/attachment/useOpenAttachmentCanvas', () => ({
  useOpenAttachmentCanvas: () => ({ openAttachmentCanvas: vi.fn() }),
}));

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({
      isOpen: false,
      isLoading: false,
      content: { type: actual.AttachmentContentType.PlainText, text: '' },
      fileName: undefined,
      attachmentId: undefined,
      openCanvasLoading: vi.fn(),
      openCanvas: vi.fn(),
      closeCanvas: vi.fn(),
    }),
  };
});

vi.mock('../../../server-api/skills.api', () => ({
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  downloadSkill: vi.fn(),
}));

/*
 * Only `LazyMarkdownEditor` is stubbed: the real `@uiw/react-md-editor` chunk
 * it lazily loads pulls in a `.css` import that this project's plain (non-nx)
 * Vitest invocation can't transform, mirroring the same stub the library's
 * own `SkillEditor.spec.tsx` uses for the same reason. Every other ui-kit
 * component (`Input`, `Textarea`, `ErrorText`, buttons, …) stays real.
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    LazyMarkdownEditor: () =>
      Promise.resolve({
        MarkdownEditor: ({
          value,
          onChange,
          placeholder,
        }: {
          value: string;
          onChange: (value: string) => void;
          placeholder?: string;
        }) => (
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ),
      }),
  };
});

const showNotification = vi.fn();

const openUploadDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getAllByRole('button', { name: 'skillEditor.addUploadLabel' })[0],
  );
};

const stageFile = (file: File) => {
  /* The upload input is visually hidden and has no accessible role/label/text; no semantic query applies. */
  // eslint-disable-next-line testing-library/no-node-access
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input as Element, { target: { files: [file] } });
};

const confirmUpload = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = () =>
    screen.getByRole('button', {
      name: 'buttons.add',
    }) as HTMLButtonElement;
  await waitFor(() => expect(button().disabled).toBe(false));
  await user.click(button());
};

/*
 * The library renders the Cancel/Create pair twice (once in the desktop
 * header row, once in the mobile sticky footer) and toggles visibility with
 * Tailwind `desktop:`/`mobile:` classes — jsdom applies no layout, so both
 * copies are present in the DOM at once. Either copy calls the same handler,
 * so tests interact with the first match.
 */
const getCancelButton = () =>
  screen.getAllByRole('button', { name: 'buttons.cancel' })[0];
const getCreateButton = () =>
  screen.getAllByRole('button', { name: 'buttons.create' })[0];
const getSaveButton = () =>
  screen.getAllByRole('button', { name: 'skillEditor.saveLabel' })[0];

/*
 * The `Input`/`Textarea`/`MarkdownEditor` fields render their `labelProps`
 * text as a visible sibling label, not as the input's accessible name (a
 * ui-kit gap outside this app-adapter's scope, per `a11y.md`'s scope
 * boundary) — placeholder text is the only reliable, unique selector here.
 */
const fillRequiredFields = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  description: string,
  instructions = 'Do the thing.',
) => {
  await user.type(
    screen.getByPlaceholderText('skillEditor.namePlaceholder'),
    name,
  );
  await user.type(
    screen.getByPlaceholderText('skillEditor.descriptionPlaceholder'),
    description,
  );
  if (instructions) {
    const instructionsField = await screen.findByPlaceholderText(
      'skillEditor.instructionsPlaceholder',
    );
    await user.type(instructionsField, instructions);
  }
};

describe('SkillEditor page', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(createSkill).mockResolvedValue({
      etag: 'etag-1',
    } as unknown as Awaited<ReturnType<typeof createSkill>>);
  });

  it('renders a recoverable error and never uploads when the bucket is missing', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: '' },
    } as unknown as ReturnType<typeof useUser>);

    render(<SkillEditor />);

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText('skillEditor.bucketMissingMessage')).toBeTruthy();
    expect(createSkill).not.toHaveBeenCalled();
  });

  it('falls back to the Catalog route when returnUrl is absent', async () => {
    render(<SkillEditor />);

    await user.click(getCancelButton());

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('rejects an external returnUrl and falls back to Catalog', async () => {
    mockSearchParams = new URLSearchParams({
      returnUrl: 'https://evil.example/',
    });

    render(<SkillEditor />);
    await user.click(getCancelButton());

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('cancels immediately with no API call', async () => {
    render(<SkillEditor />);

    await user.click(getCancelButton());

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
    expect(createSkill).not.toHaveBeenCalled();
  });

  it('calls createSkill directly (no preflight) with a normalized name, and navigates + notifies on success', async () => {
    render(<SkillEditor />);

    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(createSkill).toHaveBeenCalledWith(
        'my-bucket',
        'good-morning-breakfast',
        expect.stringContaining('# Instructions'),
        [],
        [],
      ),
    );

    await waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('blocks submission with a required-field error when Instructions is empty', async () => {
    render(<SkillEditor />);

    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
      '',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(screen.getAllByText('skillEditor.error.required')[0]).toBeTruthy(),
    );
    expect(createSkill).not.toHaveBeenCalled();
  });

  it('shows a naming conflict inline when createSkill rejects with 409', async () => {
    vi.mocked(createSkill).mockRejectedValue({
      response: { status: 409, json: () => Promise.resolve({}) },
    });

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
    );
    await user.click(getCreateButton());

    expect(
      await screen.findByText('skillEditor.error.nameConflict'),
    ).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it.each([
    [413, 'skillEditor.error.archiveTooLarge'],
    [503, 'skillEditor.error.serviceUnavailable'],
  ])(
    'maps a %s upload failure to its documented message and keeps field values',
    async (status, expectedKey) => {
      vi.mocked(createSkill).mockRejectedValue({
        response: {
          status,
          json: () => Promise.resolve({ message: 'error' }),
        },
      });

      render(<SkillEditor />);
      await fillRequiredFields(
        user,
        'Good Morning Breakfast',
        'Says good morning',
      );
      await user.click(getCreateButton());

      expect(await screen.findByText(expectedKey)).toBeTruthy();
      expect(screen.getByDisplayValue('Good Morning Breakfast')).toBeTruthy();
      expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
    },
  );

  it('shows the BFF-forwarded message on a 400 upload failure and keeps field values', async () => {
    vi.mocked(createSkill).mockRejectedValue({
      response: {
        status: 400,
        json: () =>
          Promise.resolve({
            message: 'Skill must contain a SKILL.md at its root',
          }),
      },
    });

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
    );
    await user.click(getCreateButton());

    expect(
      await screen.findByText('Skill must contain a SKILL.md at its root'),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('Good Morning Breakfast')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it('falls back to the generic path-invalid message on a 400 with no server message', async () => {
    vi.mocked(createSkill).mockRejectedValue({
      response: {
        status: 400,
        json: () => Promise.resolve({}),
      },
    });

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
    );
    await user.click(getCreateButton());

    expect(
      await screen.findByText('skillEditor.error.pathInvalid'),
    ).toBeTruthy();
  });

  it('resubmits the same request payload on retry after a 503 without rebuilding it', async () => {
    vi.mocked(createSkill).mockRejectedValueOnce({
      response: {
        status: 503,
        json: () => Promise.resolve({ message: 'unavailable' }),
      },
    });

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
    );
    await user.click(getCreateButton());

    expect(
      await screen.findByText('skillEditor.error.serviceUnavailable'),
    ).toBeTruthy();

    const firstManifest = vi.mocked(createSkill).mock.calls[0][2];

    await user.click(getCreateButton());

    await waitFor(() => expect(createSkill).toHaveBeenCalledTimes(2));
    const secondManifest = vi.mocked(createSkill).mock.calls[1][2];
    expect(secondManifest).toBe(firstManifest);
  });

  it('keeps Create/Cancel present and enabled at the default (desktop) breakpoint', () => {
    render(<SkillEditor />);

    expect((getCancelButton() as HTMLButtonElement).disabled).toBe(false);
    expect((getCreateButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows an inline error and adds nothing for a supporting file over the 1 MB limit', async () => {
    render(<SkillEditor />);
    const oversizedFile = new File([new Uint8Array(1_048_577)], 'oversized.md');

    await openUploadDialog(user);
    stageFile(oversizedFile);

    expect(
      await screen.findByText('skillEditor.error.fileTooLarge'),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'buttons.add',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('accepts a supporting file at exactly the 1 MB limit', async () => {
    render(<SkillEditor />);
    const file = new File([new Uint8Array(1_048_576)], 'fits.md');

    await openUploadDialog(user);
    stageFile(file);
    await waitFor(() => expect(screen.getAllByText('fits.md')[0]).toBeTruthy());
    await confirmUpload(user);

    await waitFor(() => expect(screen.getAllByText('fits.md')[0]).toBeTruthy());
  });

  it('a valid SKILL.md import populates the form when the form is clean', async () => {
    render(<SkillEditor />);
    const manifestFile = new File(
      ['---\nname: good-morning\ndescription: A greeting skill\n---\n\nDo it.'],
      'SKILL.md',
    );

    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);

    expect(
      screen.queryByText('skillEditor.manifestImportConfirmTitle'),
    ).toBeNull();
    expect(await screen.findByDisplayValue('good-morning')).toBeTruthy();
    expect(screen.getByDisplayValue('A greeting skill')).toBeTruthy();
  });

  it('asks for confirmation before importing SKILL.md over a dirty form', async () => {
    render(<SkillEditor />);
    await user.type(
      screen.getByPlaceholderText('skillEditor.namePlaceholder'),
      'my-draft',
    );
    const manifestFile = new File(
      ['---\nname: good-morning\ndescription: A greeting skill\n---\n\nDo it.'],
      'SKILL.md',
    );

    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);

    expect(
      await screen.findByText('skillEditor.manifestImportConfirmTitle'),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('my-draft')).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: 'buttons.replace',
      }),
    );

    expect(await screen.findByDisplayValue('good-morning')).toBeTruthy();
  });

  it('shows a dedicated message and keeps the batch staged when a manifest import is declined', async () => {
    render(<SkillEditor />);
    await user.type(
      screen.getByPlaceholderText('skillEditor.namePlaceholder'),
      'my-draft',
    );
    const manifestFile = new File(
      ['---\nname: good-morning\ndescription: A greeting skill\n---\n\nDo it.'],
      'SKILL.md',
    );

    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);

    const confirmationDialog = await screen.findByRole('dialog', {
      name: 'skillEditor.manifestImportConfirmTitle',
    });
    await user.click(
      within(confirmationDialog).getByRole('button', {
        name: 'buttons.cancel',
      }),
    );

    expect(
      await screen.findByText('skillEditor.error.manifestImportDeclined'),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('my-draft')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('preserves unknown frontmatter fields from an imported SKILL.md on create', async () => {
    render(<SkillEditor />);
    const manifestFile = new File(
      [
        '---\nname: good-morning\ndescription: A greeting skill\nversion: "1.0.0"\n---\n\nDo it.',
      ],
      'SKILL.md',
    );

    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);
    expect(await screen.findByDisplayValue('good-morning')).toBeTruthy();

    await user.click(getCreateButton());

    await waitFor(() => expect(createSkill).toHaveBeenCalledOnce());
    const sentManifest = vi.mocked(createSkill).mock.calls[0][2];
    expect(sentManifest).toContain('1.0.0');
  });

  it('sends a batch-added supporting file in filePaths/files, with SKILL.md never included', async () => {
    render(<SkillEditor />);
    const manifestFile = new File(
      ['---\nname: good-morning\ndescription: A greeting skill\n---\n\nDo it.'],
      'SKILL.md',
    );
    const supportingFile = new File(['notes body'], 'notes.md');

    await openUploadDialog(user);
    stageFile(manifestFile);
    stageFile(supportingFile);
    await waitFor(() =>
      expect(screen.getAllByText('notes.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);
    expect(await screen.findByDisplayValue('good-morning')).toBeTruthy();

    await user.click(getCreateButton());

    await waitFor(() =>
      expect(createSkill).toHaveBeenCalledWith(
        'my-bucket',
        'good-morning',
        expect.stringContaining('Do it.'),
        ['notes.md'],
        [expect.any(Blob)],
      ),
    );
  });

  it('stages and commits a dropped .zip file as an ordinary supporting file, with no unpacking', async () => {
    render(<SkillEditor />);
    await fillRequiredFields(user, 'my-skill', 'A skill');
    const zipFile = new File([new Uint8Array([1, 2, 3])], 'bundle.zip');

    await openUploadDialog(user);
    stageFile(zipFile);
    await waitFor(() =>
      expect(screen.getAllByText('bundle.zip')[0]).toBeTruthy(),
    );
    await confirmUpload(user);
    await waitFor(() =>
      expect(screen.getAllByText('bundle.zip')[0]).toBeTruthy(),
    );

    await user.click(getCreateButton());

    await waitFor(() =>
      expect(createSkill).toHaveBeenCalledWith(
        'my-bucket',
        'my-skill',
        expect.any(String),
        ['bundle.zip'],
        [expect.any(Blob)],
      ),
    );
  });
});

describe('SkillEditor page — edit mode', () => {
  const user = userEvent.setup({ delay: null });
  const manifest =
    '---\nname: docs-helper\ndescription: Explains docs\n---\n\ninstr';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams({ id: 'team-a/docs-helper' });
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
  });

  it('downloads and populates the form when id is present', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);

    await waitFor(() =>
      expect(downloadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
      ),
    );
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();
  });

  it('shows a load error and does not populate the form when the ETag header is missing', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(
      buildSkillResponse(manifest, null),
    );

    render(<SkillEditor />);

    expect(await screen.findByText('skillEditor.loadError')).toBeTruthy();
    expect(screen.queryByDisplayValue('docs-helper')).toBeNull();
  });

  it('shows a forbidden state on a 403 load failure', async () => {
    vi.mocked(downloadSkill).mockRejectedValue({
      response: { status: 403, json: () => Promise.resolve({}) },
    });

    render(<SkillEditor />);

    expect(
      await screen.findByText('skillEditor.loadErrorForbidden'),
    ).toBeTruthy();
  });

  it('shows a not-found state on a 404 load failure', async () => {
    vi.mocked(downloadSkill).mockRejectedValue({
      response: { status: 404, json: () => Promise.resolve({}) },
    });

    render(<SkillEditor />);

    expect(
      await screen.findByText('skillEditor.loadErrorNotFound'),
    ).toBeTruthy();
  });

  it('retries the same load on Retry', async () => {
    vi.mocked(downloadSkill).mockRejectedValueOnce({
      response: { status: 503, json: () => Promise.resolve({}) },
    });
    vi.mocked(downloadSkill).mockResolvedValueOnce(
      buildSkillResponse(manifest),
    );

    render(<SkillEditor />);

    expect(
      await screen.findByRole('button', { name: 'buttons.retry' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'buttons.retry' }));

    await waitFor(() => expect(downloadSkill).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();
  });

  it('renders the Name field as read-only', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);

    await waitFor(() =>
      expect(
        (screen.getByDisplayValue('docs-helper') as HTMLInputElement).disabled,
      ).toBe(true),
    );
  });

  it('saves via updateSkill with the loaded ETag and shows an update notification', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));
    vi.mocked(updateSkill).mockResolvedValue({
      etag: 'etag-2',
    } as unknown as Awaited<ReturnType<typeof updateSkill>>);

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.click(getSaveButton());

    await waitFor(() =>
      expect(updateSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.any(String),
        [],
        [],
        '"etag-1"',
      ),
    );
    await waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      ),
    );
  });

  it('preserves an unknown frontmatter field on save', async () => {
    const manifestWithVersion =
      '---\nname: docs-helper\ndescription: Explains docs\nversion: "1.2.0"\n---\n\ninstr';
    vi.mocked(downloadSkill).mockResolvedValue(
      buildSkillResponse(manifestWithVersion),
    );
    vi.mocked(updateSkill).mockResolvedValue({
      etag: 'etag-2',
    } as unknown as Awaited<ReturnType<typeof updateSkill>>);

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.click(getSaveButton());

    await waitFor(() => expect(updateSkill).toHaveBeenCalledOnce());
    const sentManifest = vi.mocked(updateSkill).mock.calls[0][2];
    expect(sentManifest).toContain('1.2.0');
  });

  it('sends both the already-loaded and a batch-added supporting file, with SKILL.md never in filePaths', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(
      buildSkillResponse(manifest, '"etag-1"', {
        'existing.md': 'existing body',
      }),
    );
    vi.mocked(updateSkill).mockResolvedValue({
      etag: 'etag-2',
    } as unknown as Awaited<ReturnType<typeof updateSkill>>);

    render(<SkillEditor />);
    await waitFor(() =>
      expect(screen.getAllByText('existing.md')[0]).toBeTruthy(),
    );

    await openUploadDialog(user);
    stageFile(new File(['new body'], 'new.md'));
    await waitFor(() => expect(screen.getAllByText('new.md')[0]).toBeTruthy());
    await confirmUpload(user);
    await waitFor(() => expect(screen.getAllByText('new.md')[0]).toBeTruthy());

    await user.click(getSaveButton());

    await waitFor(() =>
      expect(updateSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        expect.any(String),
        expect.arrayContaining(['existing.md', 'new.md']),
        [expect.any(Blob), expect.any(Blob)],
        '"etag-1"',
      ),
    );
    const [, , , filePaths] = vi.mocked(updateSkill).mock.calls[0];
    expect(filePaths).not.toContain('SKILL.md');
  });

  it('shows an explicit conflict state on a 412 save failure, with a working Reload latest', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));
    vi.mocked(updateSkill).mockRejectedValue({
      response: { status: 412, json: () => Promise.resolve({}) },
    });

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.click(getSaveButton());

    expect(await screen.findByText('skillEditor.conflictMessage')).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'skillEditor.reloadLatestLabel' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'skillEditor.reloadConfirmLabel' }),
    );

    await waitFor(() => expect(downloadSkill).toHaveBeenCalledTimes(2));
  });

  it('confirms before discarding dirty edits on Cancel, and Keep editing leaves them intact', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.type(
      screen.getByPlaceholderText('skillEditor.descriptionPlaceholder'),
      ' more',
    );

    await user.click(getCancelButton());

    expect(screen.getByText('skillEditor.unsavedChangesMessage')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', {
        name: 'skillEditor.unsavedChangesCancelLabel',
      }),
    );

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Explains docs more')).toBeTruthy();
  });

  it('navigates away when Discard changes is confirmed on a dirty Cancel', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.type(
      screen.getByPlaceholderText('skillEditor.descriptionPlaceholder'),
      ' more',
    );

    await user.click(getCancelButton());
    await user.click(
      screen.getByRole('button', {
        name: 'skillEditor.unsavedChangesConfirmLabel',
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('cancels immediately with no confirmation when the form is unchanged', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    await user.click(getCancelButton());

    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('applies a matching-name SKILL.md import after confirmation, even with no unsaved edits', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    const manifestFile = new File(
      [
        '---\nname: docs-helper\ndescription: Updated description\n---\n\nNew instructions.',
      ],
      'SKILL.md',
    );
    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);

    expect(
      await screen.findByText('skillEditor.manifestImportConfirmTitle'),
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', {
        name: 'buttons.replace',
      }),
    );

    expect(await screen.findByDisplayValue('Updated description')).toBeTruthy();
    expect(screen.getByDisplayValue('docs-helper')).toBeTruthy();
  });

  it('rejects an imported SKILL.md whose name does not match the read-only skill name', async () => {
    vi.mocked(downloadSkill).mockResolvedValue(buildSkillResponse(manifest));

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    const manifestFile = new File(
      [
        '---\nname: a-different-name\ndescription: Updated description\n---\n\nNew instructions.',
      ],
      'SKILL.md',
    );
    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);

    expect(
      await screen.findByText('skillEditor.error.manifestNameMismatch'),
    ).toBeTruthy();
    expect(screen.getByDisplayValue('docs-helper')).toBeTruthy();
    expect(screen.queryByDisplayValue('Updated description')).toBeNull();
  });

  it('preserves unknown frontmatter fields on a confirmed SKILL.md import', async () => {
    const manifestWithVersion =
      '---\nname: docs-helper\ndescription: Explains docs\nversion: "2.0.0"\n---\n\ninstr';
    vi.mocked(downloadSkill).mockResolvedValue(
      buildSkillResponse(manifestWithVersion),
    );
    vi.mocked(updateSkill).mockResolvedValue({
      etag: 'etag-2',
    } as unknown as Awaited<ReturnType<typeof updateSkill>>);

    render(<SkillEditor />);
    expect(await screen.findByDisplayValue('docs-helper')).toBeTruthy();

    const manifestFile = new File(
      [
        '---\nname: docs-helper\ndescription: Updated description\n---\n\nNew instr',
      ],
      'SKILL.md',
    );
    await openUploadDialog(user);
    stageFile(manifestFile);
    await waitFor(() =>
      expect(screen.getAllByText('SKILL.md')[0]).toBeTruthy(),
    );
    await confirmUpload(user);
    expect(
      await screen.findByText('skillEditor.manifestImportConfirmTitle'),
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', {
        name: 'buttons.replace',
      }),
    );
    expect(await screen.findByDisplayValue('Updated description')).toBeTruthy();

    await user.click(getSaveButton());

    await waitFor(() => expect(updateSkill).toHaveBeenCalledOnce());
    const sentManifest = vi.mocked(updateSkill).mock.calls[0][2];
    expect(sentManifest).toContain('2.0.0');
  });
});
