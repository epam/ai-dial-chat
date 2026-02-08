import { useCallback } from 'react';

import { ApplicationStatus } from '@/src/types/applications';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

export const useApplicationStatusActions = (
  applicationId: string | undefined,
) => {
  const dispatch = useAppDispatch();

  const handleDeploy = useCallback(() => {
    if (applicationId) {
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: applicationId,
          status: ApplicationStatus.DEPLOYING,
        }),
      );
    }
  }, [applicationId, dispatch]);

  const handleRedeploy = useCallback(() => {
    if (applicationId) {
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: applicationId,
          status: ApplicationStatus.REDEPLOYING,
        }),
      );
    }
  }, [applicationId, dispatch]);

  const handleUndeploy = useCallback(() => {
    if (applicationId) {
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: applicationId,
          status: ApplicationStatus.UNDEPLOYING,
        }),
      );
    }
  }, [applicationId, dispatch]);

  return { handleDeploy, handleRedeploy, handleUndeploy };
};
