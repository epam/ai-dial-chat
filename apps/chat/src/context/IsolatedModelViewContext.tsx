/*
 * TODO: remove in next release. Temporary reinstatement of the old
 * `?isolated-model-id` query param (dropped during the chat 2.0 rewrite),
 * needed for a quick-app-in-an-iframe embedding case. See
 * openspec/changes/restore-isolated-model-id.
 */
import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router';
import { useDeployments } from './DeploymentsContext';
import { useUiFeatures } from './UiFeaturesContext';

const ISOLATED_MODEL_ID_QUERY_PARAM = 'isolated-model-id';

/** TODO: remove in next release. Strips characters unsafe for a conversation name. */
export const sanitizeIsolatedModelId = (modelId: string): string =>
  modelId.replace(/[^A-Za-z0-9_-]/g, '');

const ISOLATED_VIEW_FORCED_FEATURES = new Set<OverlayFeature>([
  OverlayFeature.DisallowChangeAgent,
  OverlayFeature.HideChangeAgent,
  OverlayFeature.HideEmptyChatChangeAgent,
  OverlayFeature.HideNewConversation,
  OverlayFeature.HideNavigationMenu,
]);

interface IsolatedModelViewContextType {
  isActive: boolean;
  isNotFound: boolean;
  resolvedDeploymentId: string | null;
}

const IsolatedModelViewContext = createContext<
  IsolatedModelViewContextType | undefined
>(undefined);

export const IsolatedModelViewProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { search } = useLocation();
  const { items, isLoading: isDeploymentsLoading } = useDeployments();
  const { applyIsolatedViewOverride } = useUiFeatures();
  const appliedOverrideRef = useRef(false);

  const modelId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get(ISOLATED_MODEL_ID_QUERY_PARAM) || null;
  }, [search]);

  const resolvedDeployment = useMemo(
    () => (modelId ? findDeploymentByIdOrReference(items, modelId) : null),
    [items, modelId],
  );

  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    if (!modelId) return;
    if (resolvedDeployment) {
      setIsNotFound(false);
      return;
    }
    if (!isDeploymentsLoading) {
      setIsNotFound(true);
    }
  }, [modelId, resolvedDeployment, isDeploymentsLoading]);

  /*
   * TODO: remove in next release. Applied on `modelId` presence alone, not on
   * `resolvedDeployment` — deployments load asynchronously, and waiting for
   * resolution let the conversations panel/nav briefly open by default
   * before the override landed. The old feature hid this UI purely on query
   * param presence too (`isIsolatedView = params?.has(...)`), independent of
   * whether the id ever resolved to a real deployment.
   */
  useEffect(() => {
    if (!modelId || appliedOverrideRef.current) return;
    appliedOverrideRef.current = true;
    applyIsolatedViewOverride(ISOLATED_VIEW_FORCED_FEATURES);
  }, [modelId, applyIsolatedViewOverride]);

  const value = useMemo(
    () => ({
      isActive: !!modelId,
      isNotFound,
      resolvedDeploymentId: resolvedDeployment?.id ?? null,
    }),
    [modelId, isNotFound, resolvedDeployment],
  );

  return (
    <IsolatedModelViewContext.Provider value={value}>
      {children}
    </IsolatedModelViewContext.Provider>
  );
};

export const useIsolatedModelView = (): IsolatedModelViewContextType => {
  const context = useContext(IsolatedModelViewContext);
  if (!context) {
    throw new Error(
      'useIsolatedModelView must be used within an IsolatedModelViewProvider',
    );
  }
  return context;
};
