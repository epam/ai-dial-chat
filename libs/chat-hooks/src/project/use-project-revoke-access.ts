import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useRef, useState } from 'react';
import { getApiErrorDetails } from '../api-error/api-error';
import {
  notifyProjectAccessRevoked,
  type ProjectSharingClient,
} from './project-sharing-client';

/** Host notifications and dialog lifecycle for a project revoke. */
export interface ProjectRevokeAccessHandlers {
  /** Called after successful revoke; the host may notify and close the dialog. */
  onRevoked: (project: ProjectDetailsDto) => void;
  /** Called on failure with the request trace id when available. */
  onError: (project: ProjectDetailsDto, requestId?: string) => void;
}

/** Revokes recipients' access while keeping the owner's project, pins and route. */
export const useProjectRevokeAccess = (
  client: ProjectSharingClient,
  project: ProjectDetailsDto | null,
  { onRevoked, onError }: ProjectRevokeAccessHandlers,
) => {
  const [isRevoking, setIsRevoking] = useState(false);
  const inFlight = useRef(false);
  const confirmRevoke = useCallback(async () => {
    if (!project?.canManage || inFlight.current) return;
    inFlight.current = true;
    setIsRevoking(true);
    try {
      await client.revokeSharedAccess({
        revokeSharedAccessDto: { itemId: project.id },
      });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      onError(project, traceId);
      return;
    } finally {
      inFlight.current = false;
      setIsRevoking(false);
    }
    notifyProjectAccessRevoked(client, project.id);
    onRevoked(project);
  }, [client, project, onRevoked, onError]);
  return { isRevoking, confirmRevoke };
};
