import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';
import {
  DEFAULT_QUICK_APPS_SCHEMA_2_ID,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { CodeAppForm } from '@/src/components/AppsEditor/EditorForm/CodeAppForm';
import { CustomAppForm } from '@/src/components/AppsEditor/EditorForm/CustomAppForm';
import { CustomViewerForm } from '@/src/components/AppsEditor/EditorForm/CustomViewerForm';
import { ExternalAppForm } from '@/src/components/AppsEditor/EditorForm/ExternalAppForm';
import { GeneralForm } from '@/src/components/AppsEditor/EditorForm/GeneralForm';
import { QuickApp2Form } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form';
import { QuickAppForm } from '@/src/components/AppsEditor/EditorForm/QuickAppForm';

interface EditorFormProps {
  onNextClick: () => void;
}

export const EditorForm = ({ onNextClick }: EditorFormProps) => {
  const router = useRouter();
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const { [AppsEditorQuery.Schema]: typeQuery = '' } = router.query;
  const type = decodeURIComponent(typeQuery.toString());

  const quickAppSchemaId = useMemo(() => {
    return DefaultsService.get(
      'quickAppsSchemaId',
      DEFAULT_QUICK_APPS_SCHEMA_ID,
    );
  }, []);

  const quickAppSchemaId2 = useMemo(() => {
    return DefaultsService.get(
      'quickAppsSchemaId2',
      DEFAULT_QUICK_APPS_SCHEMA_2_ID,
    );
  }, []);

  const externalAppsSchemaId = useMemo(() => {
    return DefaultsService.get(
      'externalAppsSchemaId',
      DEFAULT_EXTERNAL_APPS_SCHEMA_ID,
    );
  }, []);

  const getSettingsForm = useCallback(() => {
    if (quickAppSchemaId.endsWith(type.toString())) {
      return <QuickAppForm />;
    }
    if (quickAppSchemaId2.endsWith(type.toString())) {
      return <QuickApp2Form />;
    }
    if (externalAppsSchemaId.endsWith(type.toString())) {
      return <ExternalAppForm />;
    }

    switch (type) {
      case ApplicationType.CUSTOM_APP:
        return <CustomAppForm />;
      case ApplicationType.CODE_APP:
        return <CodeAppForm />;
      default:
        if (
          schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl] &&
          schema[ApplicationTypeSchemaProperties.applicationTypeDisplayName]
        ) {
          return <CustomViewerForm />;
        }
        return null;
    }
  }, [externalAppsSchemaId, quickAppSchemaId, quickAppSchemaId2, schema, type]);

  switch (editorStep) {
    case MarketplaceEditorSteps.Settings:
      return getSettingsForm();
    case MarketplaceEditorSteps.General:
    default:
      return <GeneralForm onNextClick={onNextClick} />;
  }
};
