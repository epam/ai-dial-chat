import {
  AccessField,
  AccessLevel,
  type AccessContentOption,
  type AccessEntry,
  type AccessFieldLabels,
  type AccessReadOnlyChip,
} from '@epam/ai-dial-builder-form';
import {
  APPLICATION_ACCESS_ALLOWED_LEVELS,
  APPLICATION_ACCESS_CONTENT_TYPES,
  ApplicationAccessContentType,
  ApplicationAccessLoadStatus,
} from '@epam/ai-dial-chat-hooks';
import { GhostButton, LiveRegion, Spinner } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import type { ApplicationAccessEditor } from '../../hooks/application-editor/useApplicationAccessEditor';

interface Props {
  /** The Access state of the editor this section belongs to. */
  editor: ApplicationAccessEditor;
}

const CONTENT_LABEL_KEYS: Record<
  ApplicationAccessContentType,
  AppsEditorI18nKeys
> = {
  [ApplicationAccessContentType.Files]: AppsEditorI18nKeys.AccessContentFiles,
  [ApplicationAccessContentType.Projects]:
    AppsEditorI18nKeys.AccessContentProjects,
  [ApplicationAccessContentType.Skills]: AppsEditorI18nKeys.AccessContentSkills,
  [ApplicationAccessContentType.Prompts]:
    AppsEditorI18nKeys.AccessContentPrompts,
  [ApplicationAccessContentType.Conversations]:
    AppsEditorI18nKeys.AccessContentConversations,
  [ApplicationAccessContentType.Applications]:
    AppsEditorI18nKeys.AccessContentApplications,
  [ApplicationAccessContentType.Toolsets]:
    AppsEditorI18nKeys.AccessContentToolsets,
};

/** Access section of the application editor: the stored list's load state, then the field that edits it. */
const ApplicationAccessSection: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();
  const { access, status, hasStoredEntries, retry } = editor;
  const { entries, preserved, setEntries } = access;

  const contentOptions = useMemo<AccessContentOption[]>(
    () =>
      APPLICATION_ACCESS_CONTENT_TYPES.map((type) => ({
        id: type,
        label: t(CONTENT_LABEL_KEYS[type]),
        allowedAccess: [...APPLICATION_ACCESS_ALLOWED_LEVELS[type]],
      })),
    [t],
  );

  const labels = useMemo<AccessFieldLabels>(
    () => ({
      title: t(AppsEditorI18nKeys.AccessTitle),
      description: t(AppsEditorI18nKeys.AccessDescription),
      configureLabel: t(AppsEditorI18nKeys.AccessConfigure),
      modalTitle: t(AppsEditorI18nKeys.AccessTitle),
      selectContent: t(AppsEditorI18nKeys.AccessSelectContent),
      selectAccess: t(AppsEditorI18nKeys.AccessSelectAccess),
      accessRead: t(AppsEditorI18nKeys.AccessRead),
      accessReadWrite: t(AppsEditorI18nKeys.AccessReadWrite),
      removeEntry: (label) =>
        t(AppsEditorI18nKeys.AccessRemoveEntry, { label }),
      deleteCard: t(AppsEditorI18nKeys.AccessDeleteCard),
      announceAdded: (label) =>
        t(AppsEditorI18nKeys.AccessAnnounceAdded, { label }),
      announceRemoved: (label) =>
        t(AppsEditorI18nKeys.AccessAnnounceRemoved, { label }),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      saveLabel: t(ButtonsI18nKeys.Save),
      closeAriaLabel: t(ButtonsI18nKeys.Close),
    }),
    [t],
  );

  const value = useMemo<AccessEntry[]>(
    () =>
      entries.map((entry) => ({
        contentId: entry.contentType,
        level: entry.accessLevel,
      })),
    [entries],
  );

  const readOnlyChips = useMemo<AccessReadOnlyChip[]>(
    () =>
      preserved.map((entry) => {
        let rightsLabel = entry.access.join('/');
        if (entry.level === AccessLevel.ReadWrite) {
          rightsLabel = t(AppsEditorI18nKeys.AccessReadWrite);
        } else if (entry.level === AccessLevel.Read) {
          rightsLabel = t(AppsEditorI18nKeys.AccessRead);
        }
        return {
          id: `${entry.index}-${entry.linkId}`,
          label: `${entry.url}: ${rightsLabel}`,
        };
      }),
    [preserved, t],
  );

  const noticeText = useMemo(() => {
    const notice = t(AppsEditorI18nKeys.AccessApprovalNotice);
    if (!hasStoredEntries) return notice;
    return `${notice} ${t(AppsEditorI18nKeys.AccessApprovalResetNotice)}`;
  }, [hasStoredEntries, t]);

  const handleChange = useCallback(
    (next: AccessEntry[]) => {
      setEntries(
        next.flatMap((entry) => {
          const contentType = APPLICATION_ACCESS_CONTENT_TYPES.find(
            (type) => type === entry.contentId,
          );
          return contentType == null
            ? []
            : [
                {
                  contentType,
                  accessLevel: entry.level,
                },
              ];
        }),
      );
    },
    [setEntries],
  );

  if (status !== ApplicationAccessLoadStatus.Loaded) {
    const hasFailed = status === ApplicationAccessLoadStatus.Failed;
    return (
      <div
        role="group"
        aria-label={t(AppsEditorI18nKeys.AccessTitle)}
        className="flex flex-col gap-2"
      >
        <LiveRegion>
          {hasFailed && t(AppsEditorI18nKeys.AccessLoadFailed)}
        </LiveRegion>
        {hasFailed ? (
          <div>
            <GhostButton label={t(ButtonsI18nKeys.Retry)} onClick={retry} />
          </div>
        ) : (
          <Spinner ariaLabel={t(AppsEditorI18nKeys.AccessLoading)} />
        )}
      </div>
    );
  }

  return (
    <AccessField
      value={value}
      onChange={handleChange}
      contentOptions={contentOptions}
      readOnlyChips={readOnlyChips}
      noticeText={noticeText}
      labels={labels}
    />
  );
};

export default memo(ApplicationAccessSection);
