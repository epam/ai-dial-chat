import {
  createSerializedKeyedWriter,
  type ProjectsApiClient,
} from '@epam/ai-dial-chat-hooks/project';
import {
  attachToProjectGeneration,
  createProjectConversation,
  deleteProjectConversation,
  getProjectConversation,
  getProjectConversationTitles,
  listProjectConversations,
  markProjectConversationViewed,
  renameProjectConversation,
  saveProjectConversation,
} from '../../server-api/project-conversations.api';
import {
  createProject,
  deleteProject,
  downloadProjectArchive,
  downloadProjectContextFile,
  getProject,
  listProjectArtifacts,
  listProjects,
  updateProject,
  watchProjects,
} from '../../server-api/projects.api';

/** Called with a project conversation's id after its viewed mark was written. */
type ProjectConversationViewedListener = (conversationId: string) => void;

const viewedListeners = new Set<ProjectConversationViewedListener>();

/** Calls `listener` after every successful viewed write; returns the function that removes it. */
export const subscribeProjectConversationViewed = (
  listener: ProjectConversationViewedListener,
): (() => void) => {
  viewedListeners.add(listener);
  return () => {
    viewedListeners.delete(listener);
  };
};

const notifyViewed = (conversationId: string) => {
  for (const listener of [...viewedListeners]) {
    try {
      listener(conversationId);
    } catch {
      /* One listener's failure reaches neither the others nor the writer. */
    }
  }
};

/*
 * One queue for the viewed marks of both project pages: it outlives a route
 * change, runs one write at a time, and lets a starting generation drop a
 * mark still waiting for its chat. Listeners hear of a write only once it
 * succeeded: a dropped write never runs, and a failed one rejects first.
 */
export const projectViewedWriter = createSerializedKeyedWriter(async (id) => {
  await markProjectConversationViewed(id);
  notifyViewed(id);
});

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
  listProjectArtifacts: (...args) => listProjectArtifacts(...args),
  listProjectConversations: (...args) => listProjectConversations(...args),
  getProjectConversationTitles: (...args) =>
    getProjectConversationTitles(...args),
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
  markProjectConversationViewed: (id) => projectViewedWriter.enqueue(id),
  attachToProjectGeneration: (...args) => attachToProjectGeneration(...args),
  watchProjects: (...args) => watchProjects(...args),
};
