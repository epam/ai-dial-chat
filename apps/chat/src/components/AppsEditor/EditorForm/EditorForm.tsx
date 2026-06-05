import { useCallback } from 'react';

import { useRouter } from 'next/router';

import {
  isExternalAppEditor,
  isQuickApp2Editor,
  isQuickAppEditor,
} from '@/src/utils/app/application';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';

import { CodeAppForm } from '@/src/components/AppsEditor/EditorForm/CodeAppForm';
import { CustomAppForm } from '@/src/components/AppsEditor/EditorForm/CustomAppForm';
import { CustomViewerForm } from '@/src/components/AppsEditor/EditorForm/CustomViewerForm';
import { ExternalAppForm } from '@/src/components/AppsEditor/EditorForm/ExternalAppForm';
import { GeneralForm } from '@/src/components/AppsEditor/EditorForm/GeneralForm';
import { QuickApp2Form } from '@/src/components/AppsEditor/EditorForm/QuickApp2Form/QuickApp2Form';
import { QuickAppForm } from '@/src/components/AppsEditor/EditorForm/QuickAppForm';
import { SchemaDrivenForm } from '@/src/components/AppsEditor/EditorForm/SchemaDrivenForm';

interface EditorFormProps {
  onNextClick: () => void;
  onAutoSave: () => void;
}

export const EditorForm = ({ onNextClick, onAutoSave }: EditorFormProps) => {
  const router = useRouter();
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const { [AppsEditorQuery.Schema]: typeQuery = '' } = router.query;
  const type = decodeURIComponent(typeQuery.toString());

  const getSettingsForm = useCallback(() => {
    if (isQuickAppEditor(type.toString())) {
      return <QuickAppForm />;
    }
    if (isQuickApp2Editor(type.toString())) {
      return <QuickApp2Form onAutoSave={onAutoSave} />;
    }
    if (isExternalAppEditor(type.toString())) {
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
        } else if (schema?.properties) return <SchemaDrivenForm />;
        return null;
    }
  }, [onAutoSave, schema, type]);

  switch (editorStep) {
    case MarketplaceEditorSteps.Settings:
      return getSettingsForm();
    case MarketplaceEditorSteps.General:
    default:
      return <GeneralForm onNextClick={onNextClick} />;
  }
};
