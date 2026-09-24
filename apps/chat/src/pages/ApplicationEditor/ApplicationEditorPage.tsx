import type { FC } from 'react';
import { memo } from 'react';
import type { ApplicationEditorKind } from '../../types/application-editor';
import { isApplicationEditorPageDefinition } from '../../utils/application-editor';
import ApplicationFormEditor from './ApplicationFormEditor';
import { APPLICATION_EDITOR_DEFINITIONS } from './definitions';

interface Props {
  kind: ApplicationEditorKind;
}

const ApplicationEditorPage: FC<Props> = ({ kind }) => {
  const definition = APPLICATION_EDITOR_DEFINITIONS[kind];

  if (!definition) return null;

  if (isApplicationEditorPageDefinition(definition)) {
    return <>{definition.renderPage()}</>;
  }

  // Keyed by kind so switching kinds on one mount starts a fresh form.
  return <ApplicationFormEditor key={kind} definition={definition} />;
};

export default memo(ApplicationEditorPage);
