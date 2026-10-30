import { useEffect, useRef } from 'react';
/** Host selection and conversation lifecycle inputs. */
export interface DeploymentChangeTrackingOptions {
  /** Active conversation identity; absent outside a conversation. */
  conversationId: string | undefined;
  /** Restored or user-selected deployment. */
  selectedDeploymentId: string | null;
  /** Whether conversation restoration has finished. */
  isLoaded: boolean;
  /** Reports user changes after restoration. */
  onChange: (previous: string | null, next: string) => void;
}
/** Tracks user selection changes without treating conversation restoration as a change. */
export const useDeploymentChangeTracking = ({
  conversationId,
  selectedDeploymentId,
  isLoaded,
  onChange,
}: DeploymentChangeTrackingOptions): void => {
  const baseline = useRef<
    { conversationId: string; deploymentId: string | null } | undefined
  >(undefined);
  useEffect(() => {
    if (!conversationId || !isLoaded) {
      baseline.current = undefined;
      return;
    }
    const previous = baseline.current;
    baseline.current = { conversationId, deploymentId: selectedDeploymentId };
    if (
      !previous ||
      previous.conversationId !== conversationId ||
      previous.deploymentId === selectedDeploymentId ||
      selectedDeploymentId === null
    )
      return;
    onChange(previous.deploymentId, selectedDeploymentId);
  }, [conversationId, selectedDeploymentId, isLoaded, onChange]);
};
