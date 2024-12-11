import { Control, UseFormSetValue } from 'react-hook-form';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';
import { ExampleTypes } from '@/src/constants/code-apps';

import { FormData } from '../form';
import { CodeAppExampleLink } from './CodeAppExampleLink';

interface CodeAppExampleLinkProps {
  fileNames: string[];
  folderId: string;
  setValue: UseFormSetValue<FormData>;
  control: Control<FormData>;
}

export const CodeAppExamples = ({
  fileNames,
  folderId,
  ...formProps
}: CodeAppExampleLinkProps) => {
  if (!fileNames.includes(CODEAPPS_REQUIRED_FILES.APP)) {
    return (
      <div className="flex gap-3 divide-x divide-primary">
        <CodeAppExampleLink
          exampleType={ExampleTypes.HELLO_WORLD}
          folderId={folderId}
          fileNames={fileNames}
          {...formProps}
        />
        <CodeAppExampleLink
          exampleType={ExampleTypes.SIMPLE_RAG}
          folderId={folderId}
          fileNames={fileNames}
          className="pl-3"
          {...formProps}
        />
      </div>
    );
  }
  if (!fileNames.includes(CODEAPPS_REQUIRED_FILES.REQUIREMENTS)) {
    return (
      <div>
        <CodeAppExampleLink
          exampleType={ExampleTypes.REQUIREMENTS}
          folderId={folderId}
          fileNames={fileNames}
          {...formProps}
        />
      </div>
    );
  }

  return null;
};
