import { GetServerSideProps } from 'next';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { getLayout } from '@/src/pages/_app';

import { FileManager } from '@/src/components/FileManager/FileManager';
import { BaseHeader } from '@/src/components/Header/BaseHeader';

import { Feature } from '@epam/ai-dial-shared';

function FilesManagerPage() {
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  return (
    <div className="flex size-full flex-col">
      {enabledFeatures.has(Feature.Header) && <BaseHeader />}
      <FileManager />
    </div>
  );
}

FilesManagerPage.getLayout = getLayout;

export default FilesManagerPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  return getCommonPageProps(context);
};
