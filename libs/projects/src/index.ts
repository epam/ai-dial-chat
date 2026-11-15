/* The New project form is a composed surface: the published stylesheet
 * includes the structural styles of its builder-form dependency. */
import '@epam/ai-dial-builder-form/styles.css';

export { Projects } from './components/Projects/Projects';
export type { ProjectItem } from './models/project-item';
export type {
  ProjectsColors,
  ProjectsLabels,
  ProjectsProps,
  ProjectsStyles,
  ProjectsTypography,
} from './models/projects-props';
export { ProjectSource } from './types/project-source';
export { ProjectsSortKey } from './types/projects-sort-key';
export { ProjectCreateForm } from './components/ProjectCreateForm/ProjectCreateForm';
export { ProjectView } from './components/ProjectView/ProjectView';
export { ProjectConversationList } from './components/ProjectConversationList/ProjectConversationList';
export type {
  ProjectConversationListColors,
  ProjectConversationListItem,
  ProjectConversationListLabels,
  ProjectConversationListProps,
  ProjectConversationListTypography,
} from './models/project-conversation-list-props';
export { ProjectConversationsPanel } from './components/ProjectConversationsPanel/ProjectConversationsPanel';
export type {
  ProjectConversationsPanelLabels,
  ProjectConversationsPanelProps,
} from './models/project-conversations-panel-props';
export { ProjectOutputs } from './components/ProjectOutputs/ProjectOutputs';
export type {
  ProjectOutputItem,
  ProjectOutputsColors,
  ProjectOutputsLabels,
  ProjectOutputsProps,
  ProjectOutputsStyles,
  ProjectOutputsTypography,
} from './models/project-outputs-props';
export { ProjectRemoveFromListConfirmation } from './components/ProjectRemoveFromListConfirmation/ProjectRemoveFromListConfirmation';
export type {
  ProjectRemoveFromListConfirmationLabels,
  ProjectRemoveFromListConfirmationProps,
} from './models/project-remove-from-list-confirmation-props';
export { ProjectChatHeader } from './components/ProjectChatHeader/ProjectChatHeader';
export type { ProjectChatHeaderProps } from './models/project-chat-header-props';
export type {
  ProjectContextFileItem,
  ProjectViewColors,
  ProjectViewLabels,
  ProjectViewModel,
  ProjectViewProps,
  ProjectViewStyles,
  ProjectViewTypography,
} from './models/project-view-props';
export type {
  ProjectCreateFormColors,
  ProjectCreateFormErrors,
  ProjectCreateFormLabels,
  ProjectCreateFormProps,
  ProjectCreateFormStyles,
  ProjectCreateFormTypography,
  ProjectCreateFormValues,
  ProjectDropZoneLinks,
} from './models/project-create-form-props';
export type {
  ProjectContextFile,
  StoredProjectContextFile,
} from './models/project-context-file';
export { ContextFileRejection } from './types/context-file-rejection';
export { ProjectNameError } from './types/project-name-error';
export {
  checkContextFiles,
  filterContextFileItems,
  getContextFilesSize,
  isStoredContextFile,
  type ContextFileCheck,
  type ContextFileLimits,
  type RejectedContextFile,
} from './utils/context-files';
export {
  PROJECT_NAME_MAX_BYTES,
  validateProjectName,
} from './utils/project-name';

export { ProjectRevokeAccessConfirmation } from './components/ProjectRevokeAccessConfirmation/ProjectRevokeAccessConfirmation';
export type {
  ProjectRevokeAccessConfirmationProps,
  ProjectRevokeAccessConfirmationLabels,
} from './models/project-revoke-access-confirmation-props';
