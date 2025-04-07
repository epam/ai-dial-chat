import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ScreenState } from '@/src/types/common';

import { Routes } from '@/src/constants/routes';

import { getLayout } from '@/src/pages/_app';

import { BaseHeader } from '@/src/components/Header/BaseHeader';
import { ProfileSections } from '@/src/components/Profile/Profile';

function Profile() {
  const router = useRouter();

  const screenState = useScreenState();

  useEffect(() => {
    if (screenState !== ScreenState.SM) {
      router.push(Routes.Chat);
    }
  }, [router, screenState]);

  return (
    <div className="flex size-full flex-col sm:pt-0">
      <BaseHeader />
      <ProfileSections />
    </div>
  );
}

Profile.getLayout = getLayout;

export default Profile;

export const getServerSideProps = getCommonPageProps;
