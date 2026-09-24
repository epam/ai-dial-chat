import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { useDeployments } from '../../context/DeploymentsContext';

/** Uses the draft model, independently of the active chat deployment. */
export const useScheduledTaskSkillSupport = (modelId?: string) => {
  const { items } = useDeployments();
  return (
    findDeploymentByIdOrReference(items, modelId ?? null)?.features
      ?.skillsSupported === true
  );
};
