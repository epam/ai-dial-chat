import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { CODE_APPS_EXAMPLES, ExampleTypes } from '@/src/constants/code-apps';

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
  const dispatch = useAppDispatch();
  const onClick = useCallback(() => {
    const example = CODE_APPS_EXAMPLES[exampleType];
    Object.entries(example).map(([newFileName, content]) => {
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
  }, [dispatch, exampleType, folderId]);
  return (
    <span
      className={classNames('cursor-pointer text-accent-primary', className)}
      onClick={onClick}
    >
      {t(`Add example "${exampleType}"`)}
    </span>
  );
};
