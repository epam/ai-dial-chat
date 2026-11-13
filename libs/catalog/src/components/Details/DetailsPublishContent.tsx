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
  | 'publishLabels'
  | 'resolvePublishDependenciesLabels'
  | 'resolvePublishApprovalLabels'
  | 'publishVersionHistory'
> {
  /** Rule source options, with the panel default already applied. */
  ruleSourceOptions: string[];
  /** Publish form state, from `useDetailsPublish`. */
  publishFlow: DetailsPublishState['publishFlow'];
  /** Private dependencies to list, from `useDetailsPublish`; `undefined` when the host supplies no lookup. */
  publishDependencies?: PublishDependency[];
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
  publishFolderView,
  isPublishCredentialsEligible,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  ruleSourceOptions,
  publishLabels,
  resolvePublishDependenciesLabels,
  resolvePublishApprovalLabels,
  publishVersionHistory,
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
      hasExistingPublicationInFolder={
        publishFlow.hasExistingPublicationInFolder
      }
      hasWriteAccess={publishFlow.hasWriteAccess}
      isSubmitting={publishFlow.isSubmitting}
      hasSubmitError={publishFlow.hasSubmitError}
      allowReplace={CATALOG_PUBLISH_ALLOWS_REPLACE}
      author={publishFlow.author}
      onAuthorChange={publishFlow.setAuthor}
      publishCredentials={publishFlow.publishCredentials}
      onPublishCredentialsChange={
        isPublishCredentialsEligible
          ? publishFlow.setPublishCredentials
          : undefined
      }
      rules={publishFlow.rules}
      onRulesChange={publishFlow.setRules}
      ruleSourceOptions={ruleSourceOptions}
      isRulesLoading={publishFlow.isRulesLoading}
      hasRulesLoadError={publishFlow.hasRulesLoadError}
      labels={{
        ...publishLabels,
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
