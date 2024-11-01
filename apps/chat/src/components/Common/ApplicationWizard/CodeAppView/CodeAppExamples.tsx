import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';
import { ExampleTypes } from '@/src/constants/code-apps';

import { CodeAppExampleLink } from './CodeAppExampleLink';

interface CodeAppExampleLinkProps {
  fileNames: string[];
  folderId: string;
}

export const CodeAppExamples = ({
  fileNames,
  folderId,
}: CodeAppExampleLinkProps) => {
  if (!fileNames.includes(CODEAPPS_REQUIRED_FILES.APP)) {
    return (
      <div className="mt-3 flex gap-3 divide-x divide-primary">
        <CodeAppExampleLink
          exampleType={ExampleTypes.HELLO_WORLD}
          folderId={folderId}
          fileNames={fileNames}
        />
        <CodeAppExampleLink
          exampleType={ExampleTypes.SIMPLE_RAG}
          folderId={folderId}
          fileNames={fileNames}
          className="pl-3"
        />
      </div>
    );
  }
  if (!fileNames.includes(CODEAPPS_REQUIRED_FILES.REQUIREMENTS)) {
    return (
      <div className="mt-3">
        <CodeAppExampleLink
          exampleType={ExampleTypes.REQUIREMENTS}
          folderId={folderId}
          fileNames={fileNames}
        />
      </div>
    );
  }

  return null;
};
