import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { ApplicationActions } from '../store/application/application.reducers';
import { ApplicationSelectors } from '../store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ModelsSelectors } from '../store/models/models.reducers';

import { Routes } from '../constants/routes';

export const useAppEditorValidation = (isIdRequired: boolean) => {
  const router = useRouter();
  const {
    query: { id = '' },
  } = router;

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const areModelsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  useEffect(() => {
    if (isIdRequired && !id) {
      // id is required for this page
      router.push(Routes.NotFound);
      return;
    }
    // if models are not loaded yet or we don't have id, we should not check for applicationId
    if ((!isIdRequired && !id) || !areModelsLoaded) {
      return;
    }
    // if models are loaded, we can check for applicationId
    // if applicationId is not found in modelsMap, we should redirect to NotFound page
    const applicationId = modelsMap[id.toString()]?.id;
    if (!applicationId) {
      router.push(Routes.NotFound);
      return;
    }
    if (!applicationData) {
      dispatch(ApplicationActions.get({ applicationId }));
    }
  }, [
    modelsMap,
    applicationData,
    id,
    dispatch,
    areModelsLoaded,
    router,
    isIdRequired,
  ]);
};
