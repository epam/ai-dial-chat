import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getApplicationType } from '../utils/app/application';
import { isMyApplication } from '../utils/app/id';
import { isEntityIdPublic } from '../utils/app/publications';
import { canWriteSharedWithMe } from '../utils/app/share';
import { decode } from '@/src/utils/app/application-type-schema';

import { ApplicationActions } from '../store/application/application.reducers';
import { ApplicationSelectors } from '../store/application/application.selectors';
import { AuthSelectors } from '../store/auth/auth.selectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { ModelsSelectors } from '../store/models/models.reducers';

import { Routes } from '../constants/routes';

export const useAppEditorValidation = (isIdRequired: boolean) => {
  const router = useRouter();
  const {
    query: { id = '', slug = '' },
  } = router;

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const areModelsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

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
    const application = modelsMap[id.toString()];
    const applicationId = application?.id;
    const isAppPublic =
      applicationId && isEntityIdPublic({ id: applicationId });
    if (
      !applicationId ||
      (!isAdmin && isAppPublic) || // check if the application is public
      decode(slug.toString()) !== getApplicationType(application) // if slug is not equal to application type
    ) {
      router.push(Routes.NotFound);
      return;
    }
    if (!applicationData) {
      // allow to load application data
      dispatch(ApplicationActions.get({ applicationId }));
    }
    //check permissions to edit application
    if (
      applicationData &&
      !isAppPublic &&
      !isMyApplication({ id: applicationId }) &&
      !canWriteSharedWithMe(application)
    ) {
      router.push(Routes.NotFound);
      return;
    }
  }, [
    modelsMap,
    applicationData,
    id,
    dispatch,
    areModelsLoaded,
    router,
    isIdRequired,
    isAdmin,
    slug,
  ]);
};
