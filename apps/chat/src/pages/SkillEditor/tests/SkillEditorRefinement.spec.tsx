import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import type { SkillEditorProps } from '@epam/ai-dial-skill-editor';
import { act, render, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkillEditor from '../SkillEditor';

let form: SkillEditorProps;
let available: boolean | undefined;
let search = new URLSearchParams();
const refine = vi.fn();
vi.mock('@epam/ai-dial-skill-editor', () => ({
  SkillEditor: (props: SkillEditorProps) => {
    form = props;
    return null;
  },
}));
vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAttachmentCanvas: () => ({ closeCanvas: vi.fn() }),
}));
vi.mock('../../../hooks/attachment/useSkillFilePreviewSync', () => ({
  useSkillFilePreviewSync: () => ({ state: {}, retry: vi.fn() }),
}));
vi.mock('../../../components/SkillFilePreview/SkillFilePreview', () => ({
  SkillFilePreview: () => null,
}));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [search],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    status: 'ready',
    config: { aiTextRefinementAvailable: available },
  }),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'my-bucket' } }),
}));
vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({ refetchSkills: vi.fn() }),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));
vi.mock('../../../server-api/text-refinement.api', () => ({
  refineText: (...args: unknown[]) => refine(...args),
}));
vi.mock('../../../server-api/skills.api', () => ({
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  downloadSkillFile: vi.fn(),
  listSkillFiles: vi.fn(),
  downloadSkill: async () => ({
    headers: new Headers({ etag: 'v1' }),
    arrayBuffer: async () =>
      new Uint8Array(
        zipSync({
          'SKILL.md': strToU8(
            '---\nname: skill\ndescription: Original\n---\nInstructions',
          ),
        }),
      ).buffer,
  }),
}));

describe('skill refinement host integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    available = true;
    search = new URLSearchParams();
    refine.mockResolvedValue('Refined');
  });
  it.each([false, true])(
    'maps both field purposes and translated labels in edit=%s',
    async (edit) => {
      if (edit) search = new URLSearchParams({ id: 'skill' });
      render(<SkillEditor />);
      await waitFor(() => expect(form.isLoading).toBe(false));
      const signal = new AbortController().signal;
      await act(async () => {
        await expect(
          form.onRefineDescription?.('Exact draft', signal),
        ).resolves.toBe('Refined');
        await expect(
          form.onRefineInstructions?.('```code```', signal),
        ).resolves.toBe('Refined');
      });
      expect(refine).toHaveBeenNthCalledWith(
        1,
        TextRefinementPurpose.SkillDescription,
        'Exact draft',
        signal,
      );
      expect(refine).toHaveBeenNthCalledWith(
        2,
        TextRefinementPurpose.SkillInstructions,
        '```code```',
        signal,
      );
      expect(form.labels?.refineWithAiLabel).toBe('textRefinement.action');
      expect(form.labels?.refineUndoLabel).toBe('textRefinement.undo');
    },
  );
  it.each([false, undefined])(
    'omits callbacks for unavailable or older configuration: %s',
    async (capability) => {
      available = capability;
      render(<SkillEditor />);
      await waitFor(() => expect(form.isLoading).toBe(false));
      expect(form.onRefineDescription).toBeUndefined();
      expect(form.onRefineInstructions).toBeUndefined();
      expect(refine).not.toHaveBeenCalled();
    },
  );
});
