import {
  PublishPanel,
  type PublishDependency,
} from '@epam/ai-dial-publish-panel';
import type { FC } from 'react';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CATALOG_PUBLISH_ALLOWS_REPLACE } from '../../utils/details-panel';
import type { useDetailsPublish } from './hooks/useDetailsPublish';

type DetailsPublishState = ReturnType<typeof useDetailsPublish>;

/** Props for {@link DetailsPublishContent}. */
export interface DetailsPublishContentProps extends Pick<
  DetailsPanelProps,
  | 'item'
  | 'publishExpandedPaths'
  | 'onPublishExpandedPathsChange'
  | 'publishLoadingPaths'
  | 'getPublishDisabledReason'
  | 'canCreatePublishFolderIn'
  | 'publishLabels'
  | 'resolvePublishDependenciesLabels'
  | 'resolvePublishApprovalLabels'
  | 'publishVersionHistory'
  | 'hidePublishAuthor'
> {
  /** Publish form state, from `useDetailsPublish`. */
  publishFlow: DetailsPublishState['publishFlow'];
  /** Private dependencies to list, from `useDetailsPublish`; `undefined` when the host supplies no lookup. */
  publishDependencies?: PublishDependency[];
  /** Host sentence naming why a request is filed instead of a direct write, from `useDetailsPublish`; `undefined` for none. */
  publishDirectUnavailableNote?: string;
  /** Main/change-folder view state, from `useDetailsPublish`. */
  publishFolderView: DetailsPublishState['publishFolderView'];
  /** Whether the item may pass its credentials on to the published copy. */
  isPublishCredentialsEligible: boolean;
}

/** Body of the details panel's publish sub-view. */
export const DetailsPublishContent: FC<DetailsPublishContentProps> = ({
  item,
  publishFlow,
  publishDependencies,
  publishDirectUnavailableNote,
  publishFolderView,
  isPublishCredentialsEligible,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  getPublishDisabledReason,
  canCreatePublishFolderIn,
  publishLabels,
  resolvePublishDependenciesLabels,
  resolvePublishApprovalLabels,
  publishVersionHistory,
  hidePublishAuthor,
}) => (
  <div className="p-4 desktop:p-[22px]">
    <PublishPanel
      resource={{
        title: item.name,
        version: item.version,
        type: item.type,
        iconUrl: item.iconUrl,
      }}
      view={publishFolderView.view}
      onChangeFolderClick={publishFolderView.openFolderView}
      folderItems={publishFlow.folderItems}
      selectedFolderPath={publishFlow.selectedFolderPath}
      pendingFolderPath={publishFolderView.pendingFolderPath}
      onPendingFolderPathChange={publishFolderView.setPendingFolderPath}
      onCreateFolder={publishFlow.handleCreateFolder}
      expandedPaths={publishExpandedPaths}
      onExpandedPathsChange={onPublishExpandedPathsChange}
      loadingPaths={publishLoadingPaths}
      getDisabledReason={getPublishDisabledReason}
      canCreateFolderIn={canCreatePublishFolderIn}
      hasExistingPublicationInFolder={
        publishFlow.hasExistingPublicationInFolder
      }
      hasWriteAccess={publishFlow.hasWriteAccess}
      isSubmitting={publishFlow.isSubmitting}
      hasSubmitError={publishFlow.hasSubmitError}
      isTargetTaken={publishFlow.isTargetTaken}
      isTargetChecking={publishFlow.isTargetChecking}
      allowReplace={CATALOG_PUBLISH_ALLOWS_REPLACE}
      author={hidePublishAuthor ? undefined : publishFlow.author}
      onAuthorChange={hidePublishAuthor ? undefined : publishFlow.setAuthor}
      publishCredentials={publishFlow.publishCredentials}
      onPublishCredentialsChange={
        isPublishCredentialsEligible
          ? publishFlow.setPublishCredentials
          : undefined
      }
      isDirectWrite={publishFlow.isDirectWrite}
      directUnavailableNote={publishDirectUnavailableNote}
      labels={{
        ...publishLabels,
        /* The note replaces the credentials opt-in, so only an item that would offer one carries it. */
        directWriteNote: isPublishCredentialsEligible
          ? publishLabels?.directWriteNote
          : undefined,
        ...resolvePublishApprovalLabels?.(item),
        ...(resolvePublishDependenciesLabels && {
          dependenciesLabels: {
            ...publishLabels?.dependenciesLabels,
            ...resolvePublishDependenciesLabels(item),
          },
        }),
      }}
      dependencies={publishDependencies}
      versionHistory={publishVersionHistory}
    />
  </div>
);
