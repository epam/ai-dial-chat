import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';

import { getLayout } from '../../_app';

interface PageProps {
  _applicationData: object;
}

export default function AppsSettings({ _applicationData }: PageProps) {
  const router = useRouter();

  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full">{router.query.id}</div>
    </div>
  );
}

AppsSettings.getLayout = getLayout;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const commonProps = await getCommonPageProps(context);

  if (context.query.id) {
    return {
      props: {
        ...commonProps,
        applicationData: {},
      },
    };
  }
  return {
    redirect: {
      destination: `/404`,
    },
    props: {
      ...commonProps,
    },
  };
};
