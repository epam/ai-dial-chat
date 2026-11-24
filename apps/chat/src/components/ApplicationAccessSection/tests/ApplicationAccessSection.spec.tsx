import { ResourceDependencyAccess } from '@epam/ai-dial-chat-api-client';
import {
  ApplicationAccessContentType,
  ApplicationAccessLevel,
  type UseApplicationAccessResult,
} from '@epam/ai-dial-chat-hooks';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import type { ApplicationAccessEditor } from '../../../hooks/application-editor/useApplicationAccessEditor';
import { ApplicationAccessLoadStatus } from '../../../types/application-editor';
import ApplicationAccessSection from '../ApplicationAccessSection';

const user = userEvent.setup({ delay: null });

const makeEditor = (
  overrides: Partial<ApplicationAccessEditor> = {},
  access: Partial<UseApplicationAccessResult> = {},
): ApplicationAccessEditor => ({
  access: {
    entries: [],
    preserved: [],
    setEntries: vi.fn(),
    isDirty: false,
    reset: vi.fn(),
    toRequestValue: vi.fn(),
    ...access,
  },
  status: ApplicationAccessLoadStatus.Loaded,
  hasStoredEntries: false,
  retry: vi.fn(),
  save: vi.fn(),
  saveOrThrow: vi.fn(),
  ...overrides,
});

describe('ApplicationAccessSection', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a named loading indicator and no controls while the list loads', () => {
    render(
      <ApplicationAccessSection
        editor={makeEditor({ status: ApplicationAccessLoadStatus.Loading })}
      />,
    );
    expect(
      screen.getByRole('img', { name: AppsEditorI18nKeys.AccessLoading }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeNull();
  });

  it('shows the failure text and a retry action when the list cannot be read', async () => {
    const retry = vi.fn();
    render(
      <ApplicationAccessSection
        editor={makeEditor({
          status: ApplicationAccessLoadStatus.Failed,
          retry,
        })}
      />,
    );
    expect(screen.getByText(AppsEditorI18nKeys.AccessLoadFailed)).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Retry }),
    );

    expect(retry).toHaveBeenCalledOnce();
  });

  it('offers all seven content options, Projects second, in the modal', async () => {
    render(<ApplicationAccessSection editor={makeEditor()} />);
    await user.click(
      screen.getByRole('button', { name: AppsEditorI18nKeys.AccessConfigure }),
    );
    const [card] = within(screen.getByRole('dialog')).getAllByRole('group');

    await user.click(
      within(card).getByRole('combobox', {
        name: AppsEditorI18nKeys.AccessSelectContent,
      }),
    );

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      AppsEditorI18nKeys.AccessContentFiles,
      AppsEditorI18nKeys.AccessContentProjects,
      AppsEditorI18nKeys.AccessContentSkills,
      AppsEditorI18nKeys.AccessContentPrompts,
      AppsEditorI18nKeys.AccessContentConversations,
      AppsEditorI18nKeys.AccessContentApplications,
      AppsEditorI18nKeys.AccessContentToolsets,
    ]);
  });

  it('shows a chip per configured entry and passes edits to the draft', async () => {
    const setEntries = vi.fn();
    render(
      <ApplicationAccessSection
        editor={makeEditor(
          {},
          {
            setEntries,
            entries: [
              {
                contentType: ApplicationAccessContentType.Files,
                accessLevel: ApplicationAccessLevel.ReadWrite,
              },
            ],
          },
        )}
      />,
    );
    expect(
      screen.getByText(
        `${AppsEditorI18nKeys.AccessContentFiles}: ${AppsEditorI18nKeys.AccessReadWrite}`,
      ),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
      }),
    );

    expect(setEntries).toHaveBeenCalledWith([]);
  });

  it('shows a preserved entry as a read-only chip with its url and translated rights', () => {
    render(
      <ApplicationAccessSection
        editor={makeEditor(
          {},
          {
            preserved: [
              {
                index: 1,
                linkId: 'p',
                url: 'files/public/policies/',
                access: [ResourceDependencyAccess.Read],
                level: ApplicationAccessLevel.Read,
                isRequired: true,
              },
            ],
          },
        )}
      />,
    );
    expect(
      screen.getByText(
        `files/public/policies/: ${AppsEditorI18nKeys.AccessRead}`,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
      }),
    ).toBeNull();
  });

  it.each([
    [
      'read and write',
      [ResourceDependencyAccess.Read, ResourceDependencyAccess.Write],
      ApplicationAccessLevel.ReadWrite,
      AppsEditorI18nKeys.AccessReadWrite,
    ],
    [
      'write only',
      [ResourceDependencyAccess.Write],
      undefined,
      ResourceDependencyAccess.Write,
    ],
  ])(
    'labels a preserved entry with %s rights from its level, or the raw rights without one',
    (_, access, level, expected) => {
      render(
        <ApplicationAccessSection
          editor={makeEditor(
            {},
            {
              preserved: [
                {
                  index: 0,
                  linkId: 'x',
                  url: 'files/b/x/',
                  access,
                  level,
                  isRequired: false,
                },
              ],
            },
          )}
        />,
      );
      expect(screen.getByText(`files/b/x/: ${expected}`)).toBeTruthy();
    },
  );

  describe('approval notice', () => {
    const entry = {
      contentType: ApplicationAccessContentType.Files,
      accessLevel: ApplicationAccessLevel.Read,
    };

    it('is hidden without entries', () => {
      render(<ApplicationAccessSection editor={makeEditor()} />);
      expect(
        screen.queryByText(AppsEditorI18nKeys.AccessApprovalNotice),
      ).toBeNull();
    });

    it('says approval is needed once an entry exists', () => {
      render(
        <ApplicationAccessSection
          editor={makeEditor({}, { entries: [entry] })}
        />,
      );
      expect(
        screen.getByText(AppsEditorI18nKeys.AccessApprovalNotice),
      ).toBeTruthy();
    });

    it('adds the reset warning when the stored list already had entries', () => {
      render(
        <ApplicationAccessSection
          editor={makeEditor({ hasStoredEntries: true }, { entries: [entry] })}
        />,
      );
      expect(
        screen.getByText(
          `${AppsEditorI18nKeys.AccessApprovalNotice} ${AppsEditorI18nKeys.AccessApprovalResetNotice}`,
        ),
      ).toBeTruthy();
    });
  });
});
