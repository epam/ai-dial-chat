import { GetServerSideProps } from 'next';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { getLayout } from '@/src/pages/_app';

import { FileManager } from '@/src/components/FileManager/FileManager';

function FilesManagerPage() {
  return (
    <div className="size-full overflow-hidden">
      <FileManager />
    </div>
  );
}

FilesManagerPage.getLayout = getLayout;

export default FilesManagerPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  return getCommonPageProps(context);
};
