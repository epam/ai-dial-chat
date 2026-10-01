import type { FC } from 'react';
import { memo } from 'react';
import { useSearchParams } from 'react-router';
import { useDeployments } from '../../context/DeploymentsContext';
import { ApplicationEditorKind } from '../../types/application-editor';
import { AppsEditorQuery } from '../../types/apps-editor';
import {
  isApplicationEditorPageDefinition,
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
  // The apps editor route serves every schema; its schema decides between the embedded editor and the schema form.
  const resolvedKind = isSchemaRoute
    ? resolveSchemaEditorKind(schemas, searchParams.get(AppsEditorQuery.Schema))
    : kind;
  const definition = APPLICATION_EDITOR_DEFINITIONS[resolvedKind];

  // Waits for the schema list, so a schema-form app does not flash the embedded-editor layout first.
  if (isSchemaRoute && isLoading && schemas.length === 0) return null;

  // Guards an unknown kind at runtime, e.g. a stale route.
  if (!definition) return null;

  if (isApplicationEditorPageDefinition(definition)) {
    return <>{definition.renderPage()}</>;
  }

  // Keyed by kind so switching kinds on one mount starts a fresh form.
  return <ApplicationFormEditor key={resolvedKind} definition={definition} />;
};

export default memo(ApplicationEditorPage);
