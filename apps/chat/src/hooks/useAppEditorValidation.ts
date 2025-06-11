import { useEffect, useMemo } from 'react';

import { useRouter } from 'next/router';

import { getApplicationType } from '@/src/utils/app/application';
import { cleanSchemaId } from '@/src/utils/app/application-type-schema';
import { isApplicationId, isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { DialAIEntityModel } from '@/src/types/models';

import { ApplicationActions, PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  AuthSelectors,
  ModelsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

export const useAppEditorValidation = (isIdRequired: boolean) => {
  const router = useRouter();
  const {
    query: { id = '', slug = '', publicationUrl },
  } = router;

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const areModelsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);

  const applicationData = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const isApplicationLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const appPublicationUrl = publicationUrl
    ? decodeURIComponent(publicationUrl.toString())
    : undefined;
  const appPublication = useAppSelector((state) =>
    PublicationSelectors.selectPublicationByUrl(
      state,
      appPublicationUrl as string,
    ),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const reviewApplicationId = useMemo(() => {
    if (appPublicationUrl && appPublication?.url === appPublicationUrl) {
      return appPublication?.resources?.find((resource) =>
        isApplicationId(resource.reviewUrl),
      )?.reviewUrl;
    }

    return undefined;
  }, [appPublication?.resources, appPublication?.url, appPublicationUrl]);

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
    if (
      appPublicationUrl &&
      (appPublicationUrl !== appPublication?.url || !appPublication?.resources)
    ) {
      dispatch(
        PublicationActions.uploadPublication({ url: appPublicationUrl }),
      );
      return;
    }
    // if models are loaded, we can check for applicationId
    // if applicationId is not found in modelsMap, we should redirect to NotFound page
    const application = modelsMap[id.toString()];
    const applicationId = application?.id;
    const isAppPublic =
      applicationId && isEntityIdPublic({ id: applicationId });

    if (
      (application || applicationData) &&
      decodeURIComponent(slug.toString()) !==
        cleanSchemaId(
          getApplicationType(
            (application ?? applicationData) as DialAIEntityModel,
          ),
        )
    ) {
      // if slug is not equal to application type)
      router.push(Routes.NotFound);
      return;
    }

    if (isAdmin && appPublicationUrl) {
      if (!applicationData && !isApplicationLoading && reviewApplicationId) {
        dispatch(
          ApplicationActions.get({ applicationId: reviewApplicationId }),
        );
      }
      return; // skip permissions check and fetch reviewing application if admin is editing publication resource
    }

    if (
      !applicationId ||
      (!isAdmin && isAppPublic) // check if the application is public
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
    isApplicationLoading,
    appPublicationUrl,
    appPublication,
    reviewApplicationId,
  ]);
};
