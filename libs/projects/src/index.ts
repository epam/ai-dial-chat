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
export type {
  ProjectCreateFormColors,
  ProjectCreateFormErrors,
  ProjectCreateFormLabels,
  ProjectCreateFormProps,
  ProjectCreateFormStyles,
  ProjectCreateFormTypography,
  ProjectCreateFormValues,
} from './models/project-create-form-props';
export { ContextFileRejection } from './types/context-file-rejection';
export { ProjectNameError } from './types/project-name-error';
export {
  checkContextFiles,
  getContextFilesSize,
  type ContextFileCheck,
  type ContextFileLimits,
  type RejectedContextFile,
} from './utils/context-files';
export {
  PROJECT_NAME_MAX_BYTES,
  validateProjectName,
} from './utils/project-name';
