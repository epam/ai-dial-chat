import { ProjectCreateErrorCode } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import { mapProjectCreateError } from '../project-create-errors';

describe('mapProjectCreateError', () => {
  it('puts a taken name on the Name field', () => {
    expect(mapProjectCreateError(ProjectCreateErrorCode.NameTaken)).toEqual({
      field: 'name',
      key: ProjectsI18nKeys.CreateErrorNameTaken,
    });
  });

  it('puts an unknown removed file under Context', () => {
    expect(mapProjectCreateError(ProjectCreateErrorCode.UnknownFile)).toEqual({
      field: 'context',
      key: ProjectsI18nKeys.EditErrorUnknownFile,
    });
  });

  it('leaves a concurrent change and other codes to a toast', () => {
    expect(
      mapProjectCreateError(ProjectCreateErrorCode.ProjectChanged),
    ).toBeNull();
    expect(mapProjectCreateError(undefined)).toBeNull();
  });
});
