import {
  AccessField,
  AccessLevel,
  type AccessContentOption,
  type AccessEntry,
  type AccessFieldLabels,
  type AccessReadOnlyChip,
} from '@epam/ai-dial-builder-form';
import { ResourceDependencyAccess } from '@epam/ai-dial-chat-api-client';
import {
  APPLICATION_ACCESS_ALLOWED_LEVELS,
  APPLICATION_ACCESS_CONTENT_TYPES,
  ApplicationAccessContentType,
  ApplicationAccessLevel,
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
import { ApplicationAccessLoadStatus } from '../../types/application-editor';

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

const TO_UI_LEVEL: Record<ApplicationAccessLevel, AccessLevel> = {
  [ApplicationAccessLevel.Read]: AccessLevel.Read,
  [ApplicationAccessLevel.ReadWrite]: AccessLevel.ReadWrite,
};

const FROM_UI_LEVEL: Record<AccessLevel, ApplicationAccessLevel> = {
  [AccessLevel.Read]: ApplicationAccessLevel.Read,
  [AccessLevel.ReadWrite]: ApplicationAccessLevel.ReadWrite,
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
        allowedAccess: APPLICATION_ACCESS_ALLOWED_LEVELS[type].map(
          (level) => TO_UI_LEVEL[level],
        ),
      })),
    [t],
  );

  const labels = useMemo<AccessFieldLabels>(
    () => ({
      title: t(AppsEditorI18nKeys.AccessTitle),
      description: t(AppsEditorI18nKeys.AccessDescription),
      configureLabel: t(AppsEditorI18nKeys.AccessConfigure),
      modalTitle: t(AppsEditorI18nKeys.AccessModalTitle),
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
        level: TO_UI_LEVEL[entry.accessLevel],
      })),
    [entries],
  );

  const readOnlyChips = useMemo<AccessReadOnlyChip[]>(
    () =>
      preserved.map((entry) => {
        const rights = new Set(entry.access);
        const isReadWrite =
          rights.size === 2 &&
          rights.has(ResourceDependencyAccess.Read) &&
          rights.has(ResourceDependencyAccess.Write);
        const isRead =
          rights.size === 1 && rights.has(ResourceDependencyAccess.Read);
        let rightsLabel = entry.access.join('/');
        if (isReadWrite) rightsLabel = t(AppsEditorI18nKeys.AccessReadWrite);
        else if (isRead) rightsLabel = t(AppsEditorI18nKeys.AccessRead);
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
                  accessLevel: FROM_UI_LEVEL[entry.level],
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
            <GhostButton
              label={t(AppsEditorI18nKeys.AccessRetry)}
              onClick={retry}
            />
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
