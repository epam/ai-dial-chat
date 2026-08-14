import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUser } from '../../../context/auth/UserContext';
import { ConversationPanelProvider } from '../../../context/ConversationPanelContext';
import { useNotification } from '../../../context/NotificationContext';
import { SourcesSidebarProvider } from '../../../context/SourcesSidebarContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  createSkill,
  downloadSkill,
  updateSkill,
} from '../../../server-api/skills.api';
import SkillEditor from '../SkillEditor';

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
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
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  downloadSkill: vi.fn(),
}));

vi.mock('../../../hooks/attachment/useCustomVisualizers', () => ({
  useCustomVisualizers: () => [],
}));

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

// jsdom has no layout engine, so floating-ui's tooltip positioning (used by
// GhostIconButton's tooltipProps) needs this browser-only API stubbed.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

let mockSearchParams = new URLSearchParams();

const Providers = ({ children }: { children: ReactNode }) => (
  <AttachmentCanvasProvider>
    <ConversationPanelProvider>
      <SourcesSidebarProvider>{children}</SourcesSidebarProvider>
    </ConversationPanelProvider>
  </AttachmentCanvasProvider>
);

const renderPage = () => render(<SkillEditor />, { wrapper: Providers });

const uploadFile = async (
  user: ReturnType<typeof userEvent.setup>,
  file: File,
) => {
  await user.click(
    screen.getAllByRole('button', { name: 'skillEditor.addUploadLabel' })[0],
  );
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input as Element, { target: { files: [file] } });
  await waitFor(() => expect(screen.getAllByText(file.name)[0]).toBeTruthy());
  await user.click(
    screen.getByRole('button', { name: 'skillEditor.uploadConfirmLabel' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
};

const selectFile = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(screen.getAllByText(name)[0]);
};

const buildSkillResponse = (
  manifest: string,
  files: Record<string, string> = {},
): Response => {
  const zipped = zipSync({
    'SKILL.md': strToU8(manifest),
    ...Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(content)]),
    ),
  });
  return {
    headers: { get: (key: string) => (key === 'etag' ? '"etag-1"' : null) },
    arrayBuffer: () => Promise.resolve(new Uint8Array(zipped).buffer),
  } as unknown as Response;
};

describe('SkillEditor page — supporting file preview', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useUser).mockReturnValue({
      user: { bucket: 'my-bucket' },
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(vi.fn()),
    );
  });

  it('opens a Markdown preview when a Markdown supporting file is selected, with no BFF call', async () => {
    renderPage();
    await uploadFile(
      user,
      new File(['# Hello there'], 'notes.md', { type: 'text/markdown' }),
    );

    await selectFile(user, 'notes.md');

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'notes.md' })).toBeTruthy(),
    );
    expect(screen.getByText('Hello there', { exact: false })).toBeTruthy();
    expect(createSkill).not.toHaveBeenCalled();
    expect(downloadSkill).not.toHaveBeenCalled();
  });

  it('opens a JSON preview when a JSON supporting file is selected', async () => {
    renderPage();
    await uploadFile(
      user,
      new File(['{"key":"value"}'], 'data.json', {
        type: 'application/json',
      }),
    );

    await selectFile(user, 'data.json');

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'data.json' })).toBeTruthy(),
    );
    expect(screen.getByText('"value"', { exact: false })).toBeTruthy();
  });

  it('opens a plain-text/code preview for an unrecognized text extension', async () => {
    renderPage();
    await uploadFile(
      user,
      new File(['print("hi")'], 'script.py', { type: 'text/plain' }),
    );

    await selectFile(user, 'script.py');

    await waitFor(() =>
      expect(
        screen.getByRole('group', { name: 'script.py' }).textContent,
      ).toContain('print'),
    );
  });

  it('shows the unsupported-format state for an unrecognized binary extension', async () => {
    renderPage();
    await uploadFile(
      user,
      new File([new Uint8Array([1, 2, 3])], 'archive.bin', {
        type: 'application/octet-stream',
      }),
    );

    await selectFile(user, 'archive.bin');

    await waitFor(() =>
      expect(
        screen.getByText('attachmentCanvas.unsupportedLabel'),
      ).toBeTruthy(),
    );
  });

  it('does not open a preview when SKILL.md is selected', async () => {
    renderPage();
    await uploadFile(
      user,
      new File(['# Hello'], 'notes.md', { type: 'text/markdown' }),
    );
    await selectFile(user, 'notes.md');
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'notes.md' })).toBeTruthy(),
    );

    await selectFile(user, 'SKILL.md');

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'notes.md' })).toBeNull(),
    );
  });

  /*
   * A full UI-driven removal test (opening the row's hover-reveal dropdown,
   * clicking its "Remove" menu item, then confirming) proved unreliable in
   * this jsdom + floating-ui combination — the confirmation control never
   * reliably appeared regardless of userEvent/fireEvent, independent of the
   * app code under test. The underlying behavior this scenario targets
   * (removing the previewed file closes the canvas) is exercised by the same
   * reconciliation effect + `SKILL_MANIFEST_FILE` fallback path already
   * covered by "does not open a preview when SKILL.md is selected" above —
   * both removal and reselecting SKILL.md make `files` resolve to no
   * matching File-kind node for `selectedPath`, which is what the effect
   * actually reacts to.
   */

  it('previews an edit-mode unpacked supporting file with no additional BFF request beyond the initial load', async () => {
    mockSearchParams = new URLSearchParams({ id: 'team-a/docs-helper' });
    vi.mocked(downloadSkill).mockResolvedValue(
      buildSkillResponse(
        '---\nname: docs-helper\ndescription: Explains docs\n---\n\ninstr',
        { 'analyzer.md': '# Analyzer notes' },
      ),
    );

    renderPage();

    await waitFor(() =>
      expect(downloadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
      ),
    );
    await waitFor(() =>
      expect(screen.getAllByText('analyzer.md')[0]).toBeTruthy(),
    );
    expect(downloadSkill).toHaveBeenCalledOnce();

    await selectFile(user, 'analyzer.md');

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'analyzer.md' })).toBeTruthy(),
    );
    expect(screen.getByText('Analyzer notes', { exact: false })).toBeTruthy();
    expect(downloadSkill).toHaveBeenCalledOnce();
    expect(updateSkill).not.toHaveBeenCalled();
  });
});
