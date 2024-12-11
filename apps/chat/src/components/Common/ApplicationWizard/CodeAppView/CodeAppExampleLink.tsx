import { useCallback } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import {
  CODE_APPS_ENDPOINTS,
  CODE_APPS_EXAMPLES,
  ExampleTypes,
} from '@/src/constants/code-apps';

import { FormData } from '../form';

interface CodeAppExampleLinkProps {
  exampleType: ExampleTypes;
  folderId: string;
  fileNames: string[];
  className?: string;
}

export const CodeAppExampleLink = ({
  exampleType,
  className,
  folderId,
  fileNames,
}: CodeAppExampleLinkProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { setValue, control } = useFormContext<FormData>();

  const dispatch = useAppDispatch();

  const { append: appendEnv, fields: envs } = useFieldArray({
    control,
    name: 'env',
  });

  const handleClick = useCallback(() => {
    const example = CODE_APPS_EXAMPLES[exampleType];
    Object.entries(example.files).forEach(([newFileName, content]) => {
      if (!fileNames.includes(newFileName)) {
        dispatch(
          FilesActions.uploadFile({
            fileContent: new File([content], newFileName, {
              type: 'text/plain',
            }),
            relativePath: getIdWithoutRootPathSegments(folderId),
            id: constructPath(folderId, newFileName),
            name: newFileName,
          }),
        );
      }
    });
    if (example.endpoints) {
      Object.entries(example.endpoints).forEach(([endpoint, endValue]) => {
        const index = CODE_APPS_ENDPOINTS.findIndex(
          (end) => end.value === endpoint,
        );
        if (index !== -1) {
          setValue(`endpoints.${index}.value`, endValue);
        }
      });
    }
    if (example.variables) {
      Object.entries(example.variables).forEach(([variable, getEnvValue]) => {
        const index = envs.findIndex((item) => item.label === variable);
        if (index === -1) {
          appendEnv({
            label: variable,
            value: getEnvValue(),
            editableKey: true,
            visibleName: variable,
          });
        } else {
          setValue(`env.${index}.value`, getEnvValue());
        }
      });
    }
  }, [exampleType, fileNames, dispatch, folderId, setValue, envs, appendEnv]);

  return (
    <span
      className={classNames('cursor-pointer text-accent-primary', className)}
      onClick={handleClick}
    >
      {t('Add example "{{exampleType}}"', { exampleType })}
    </span>
  );
};
