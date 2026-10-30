import type { ProjectsApiClient } from '@epam/ai-dial-chat-hooks/project';
import {
  attachToProjectGeneration,
  createProjectConversation,
  deleteProjectConversation,
  getProjectConversation,
  listProjectConversations,
  renameProjectConversation,
  saveProjectConversation,
} from '../../server-api/project-conversations.api';
import {
  createProject,
  deleteProject,
  downloadProjectArchive,
  downloadProjectContextFile,
  getProject,
  listProjects,
  updateProject,
} from '../../server-api/projects.api';

/*
 * The project requests the chat-hooks project hooks run, resolved through the
 * app's server-api module at call time: one stable object for the hooks'
 * dependency lists, and one seam the app's tests mock.
 */
export const projectsClient: ProjectsApiClient = {
  listProjects: (signal) => listProjects({ signal }),
  getProject: (id, signal) => getProject(id, { signal }),
  createProject: (...args) => createProject(...args),
  updateProject: (
    { id, fields, newFiles, removedFileNames, contentVersion },
    signal,
  ) =>
    updateProject(
      id,
      fields,
      newFiles,
      removedFileNames,
      contentVersion,
      signal,
    ),
  deleteProject: (...args) => deleteProject(...args),
  downloadProjectArchive: (...args) => downloadProjectArchive(...args),
  downloadProjectContextFile: (...args) => downloadProjectContextFile(...args),
  listProjectConversations: (...args) => listProjectConversations(...args),
  createProjectConversation: (
    projectId,
    {
      firstMessage,
      deploymentId,
      attachments,
      configurationValue,
      formValue,
      skills,
    },
  ) =>
    createProjectConversation(
      projectId,
      firstMessage,
      deploymentId,
      attachments,
      configurationValue,
      formValue,
      skills,
    ),
  getProjectConversation: (...args) => getProjectConversation(...args),
  saveProjectConversation: (...args) => saveProjectConversation(...args),
  renameProjectConversation: (...args) => renameProjectConversation(...args),
  deleteProjectConversation: (...args) => deleteProjectConversation(...args),
  attachToProjectGeneration: (...args) => attachToProjectGeneration(...args),
};
