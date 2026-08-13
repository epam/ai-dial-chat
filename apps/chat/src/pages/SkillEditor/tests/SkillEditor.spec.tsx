import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUser } from '../../../context/auth/UserContext';
import { useNotification } from '../../../context/NotificationContext';
import { listSkills, uploadSkill } from '../../../server-api/skills.api';
import SkillEditor from '../SkillEditor';

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

vi.mock('../../../server-api/skills.api', () => ({
  listSkills: vi.fn(),
  uploadSkill: vi.fn(),
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
  instructions: string,
) => {
  await user.type(
    screen.getByPlaceholderText('skillEditor.namePlaceholder'),
    name,
  );
  await user.type(
    screen.getByPlaceholderText('skillEditor.descriptionPlaceholder'),
    description,
  );
  const instructionsField = await screen.findByPlaceholderText(
    'skillEditor.instructionsPlaceholder',
  );
  await user.type(instructionsField, instructions);
};

describe('SkillEditor page', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification,
      dismissNotification: vi.fn(),
    });
    vi.mocked(listSkills).mockResolvedValue({
      bucket: 'my-bucket',
      path: '',
      items: [],
    } as unknown as Awaited<ReturnType<typeof listSkills>>);
    vi.mocked(uploadSkill).mockResolvedValue({
      etag: 'etag-1',
    } as unknown as Awaited<ReturnType<typeof uploadSkill>>);
  });

  it('renders a recoverable error and never uploads when the bucket is missing', () => {
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: '' },
    } as unknown as ReturnType<typeof useUser>);

    render(<SkillEditor />);

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText('skillEditor.bucketMissingMessage')).toBeTruthy();
    expect(uploadSkill).not.toHaveBeenCalled();
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
    expect(listSkills).not.toHaveBeenCalled();
    expect(uploadSkill).not.toHaveBeenCalled();
  });

  it('preflight-lists then uploads a normalized name with no ifMatch, and navigates + notifies on success', async () => {
    render(<SkillEditor />);

    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(listSkills).toHaveBeenCalledWith({
        bucket: 'my-bucket',
        path: '',
      }),
    );
    await waitFor(() =>
      expect(uploadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'good-morning-breakfast',
        expect.any(Blob),
      ),
    );
    /* uploadSkill is called with exactly 3 args (no ifMatch). */
    expect(vi.mocked(uploadSkill).mock.calls[0]).toHaveLength(3);

    await waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/catalog');
  });

  it('blocks the upload when a preflight conflict is found', async () => {
    vi.mocked(listSkills).mockResolvedValue({
      bucket: 'my-bucket',
      path: '',
      items: [{ name: 'good-morning-breakfast' }],
    } as unknown as Awaited<ReturnType<typeof listSkills>>);

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(screen.getByText('skillEditor.error.nameConflict')).toBeTruthy(),
    );
    expect(uploadSkill).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it.each([
    [409, 'skillEditor.error.nameConflict'],
    [412, 'skillEditor.error.nameConflict'],
    [413, 'skillEditor.error.archiveTooLarge'],
    [422, 'skillEditor.error.tooManyFiles'],
    [503, 'skillEditor.error.serviceUnavailable'],
  ])(
    'maps a %s upload failure to its documented message and keeps field values',
    async (status, expectedKey) => {
      vi.mocked(uploadSkill).mockRejectedValue({
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
        '# Instructions',
      );
      await user.click(getCreateButton());

      await waitFor(() => expect(screen.getByText(expectedKey)).toBeTruthy());
      expect(screen.getByDisplayValue('Good Morning Breakfast')).toBeTruthy();
      expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
    },
  );

  it('shows the BFF-forwarded message on a 400 upload failure and keeps field values', async () => {
    vi.mocked(uploadSkill).mockRejectedValue({
      response: {
        status: 400,
        json: () =>
          Promise.resolve({ message: 'Skill archive is missing SKILL.md' }),
      },
    });

    render(<SkillEditor />);
    await fillRequiredFields(
      user,
      'Good Morning Breakfast',
      'Says good morning',
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(
        screen.getByText('Skill archive is missing SKILL.md'),
      ).toBeTruthy(),
    );
    expect(screen.getByDisplayValue('Good Morning Breakfast')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalledWith('/catalog');
  });

  it('falls back to the generic path-invalid message on a 400 with no server message', async () => {
    vi.mocked(uploadSkill).mockRejectedValue({
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
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(screen.getByText('skillEditor.error.pathInvalid')).toBeTruthy(),
    );
  });

  it('resubmits the same archive on retry after a 503 without rebuilding it', async () => {
    vi.mocked(uploadSkill).mockRejectedValueOnce({
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
      '# Instructions',
    );
    await user.click(getCreateButton());

    await waitFor(() =>
      expect(
        screen.getByText('skillEditor.error.serviceUnavailable'),
      ).toBeTruthy(),
    );

    /*
     * Extracting the archive argument to compare object identity across two
     * calls has no `toHaveBeenCalledWith` equivalent — this is not an
     * argument-value assertion, it is an identity check.
     */
    const firstArchive = vi.mocked(uploadSkill).mock.calls[0][2];

    await user.click(getCreateButton());

    await waitFor(() => expect(uploadSkill).toHaveBeenCalledTimes(2));
    const secondArchive = vi.mocked(uploadSkill).mock.calls[1][2];
    expect(secondArchive).toBe(firstArchive);
  });

  it('keeps Create/Cancel present and enabled at the default (desktop) breakpoint', () => {
    render(<SkillEditor />);

    expect((getCancelButton() as HTMLButtonElement).disabled).toBe(false);
    expect((getCreateButton() as HTMLButtonElement).disabled).toBe(false);
  });
});
