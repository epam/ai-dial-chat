import type { FC } from 'react';
import { memo } from 'react';
import { useSearchParams } from 'react-router';
import RequireCatalogCreation from '../../components/RequireCatalogCreation/RequireCatalogCreation';
import { useDeployments } from '../../context/DeploymentsContext';
import { ApplicationEditorKind } from '../../types/application-editor';
import { AppsEditorQuery } from '../../types/apps-editor';
import {
  isApplicationEditorPageDefinition,
  resolveApplicationCreationCheck,
  resolveSchemaEditorKind,
} from '../../utils/application-editor';
import ApplicationFormEditor from './ApplicationFormEditor';
import { APPLICATION_EDITOR_DEFINITIONS } from './definitions';

interface Props {
  kind: ApplicationEditorKind;
}

const ApplicationEditorPage: FC<Props> = ({ kind }) => {
  const [searchParams] = useSearchParams();
  const { schemas, isLoading } = useDeployments();
  const isSchemaRoute = kind === ApplicationEditorKind.QuickApp;
  const schemaId = searchParams.get(AppsEditorQuery.Schema);
  // The apps editor route serves every schema; its schema decides between the embedded editor and the schema form.
  const resolvedKind = isSchemaRoute
    ? resolveSchemaEditorKind(schemas, schemaId)
    : kind;
  const definition = APPLICATION_EDITOR_DEFINITIONS[resolvedKind];

  // Waits for the schema list, so a schema-form app does not flash the embedded-editor layout first.
  if (isSchemaRoute && isLoading && schemas.length === 0) return null;

  // Guards an unknown kind at runtime, e.g. a stale route.
  if (!definition) return null;

  const creationCheck = resolveApplicationCreationCheck(
    definition.creationType,
    searchParams,
    schemas,
    isLoading,
  );
  /* An id is what puts every editor in edit mode; without one it creates. */
  const isCreateMode = !searchParams.get(definition.idQueryParam);

  return (
    <RequireCatalogCreation
      // A new kind or schema is a new create session, checked afresh.
      key={`${resolvedKind}:${schemaId ?? ''}`}
      isCreateMode={isCreateMode}
      {...creationCheck}
    >
      {isApplicationEditorPageDefinition(definition) ? (
        definition.renderPage()
      ) : (
        // Keyed by kind so switching kinds on one mount starts a fresh form.
        <ApplicationFormEditor
          key={resolvedKind}
          definition={definition}
          creationCheck={creationCheck}
        />
      )}
    </RequireCatalogCreation>
  );
};

export default memo(ApplicationEditorPage);
