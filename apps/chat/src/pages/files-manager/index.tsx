import { GetServerSideProps } from 'next';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { getLayout } from '@/src/pages/_app';

import { FileManager } from '@/src/components/FileManager/FileManager';
import { BaseHeader } from '@/src/components/Header/BaseHeader';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { Feature } from '@epam/ai-dial-shared';

function FilesManagerPage() {
  const dispatch = useAppDispatch();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );

  const onClose = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };
  return (
    <div className="flex size-full flex-col">
      {enabledFeatures.has(Feature.Header) && (
        <BaseHeader
          RightItems={
            <>
              <div className="flex w-[48px] items-center justify-center md:w-auto">
                <User />
              </div>
              <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
            </>
          }
        />
      )}
      <FileManager />
    </div>
  );
}

FilesManagerPage.getLayout = getLayout;

export default FilesManagerPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  return getCommonPageProps(context);
};
