import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import HomeContext from '@/pages/api/home/home.context';

import FileArrowRightIcon from '../../public/images/icons/file-arrow-right.svg';
import GearIcon from '../../public/images/icons/gear.svg';
import UserIcon from '../../public/images/icons/user.svg';
import { FooterMessage } from '../Chat/FooterMessage';

const UserInfo = () => {
  const { data: session } = useSession();
  return (
    <div className=" w-full border-b border-gray-300 p-2 text-gray-800 dark:border-gray-900 dark:text-gray-200">
      <div className="flex h-[42px] items-center">
        <UserIcon
          className="mx-2"
          width={18}
          height={18}
          stroke="currentColor"
        />

        <span className="grow">{session?.user?.name ?? ''}</span>
      </div>
    </div>
  );
};

const UserSettings = () => {
  const { dispatch: homeDispatch } = useContext(HomeContext);
  const { t } = useTranslation('sidebar');

  const onClick = () => {
    homeDispatch({ field: 'isUserSettingsOpen', value: true });
  };

  return (
    <div className="flex h-[42px] items-center gap-2 px-2" onClick={onClick}>
      <GearIcon
        className="dark:text-gray-500"
        width={18}
        height={18}
        stroke="currentColor"
      />
      <span>{t('Settings')}</span>
    </div>
  );
};

const Logout = () => {
  const { data: session } = useSession();
  const { t } = useTranslation('sidebar');

  const onClick = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return (
    <div className="flex h-[42px] items-center gap-2 px-2" onClick={onClick}>
      <FileArrowRightIcon
        className="dark:text-gray-500"
        width={18}
        height={18}
        stroke="currentColor"
      />
      <span>{session ? t('Log out') : t('Login')}</span>
    </div>
  );
};
const UserMenu = () => {
  return (
    <div className="flex flex-col gap-1 p-2">
      <UserSettings />
      <Logout />
    </div>
  );
};

export const UserMobile = () => {
  const {
    state: { footerHtmlMessage, enabledFeatures },
  } = useContext(HomeContext);
  return (
    <div
      className="fixed right-0 top-12 z-40 flex w-[260px] flex-col border-gray-300 bg-gray-100 dark:border-gray-900 dark:bg-gray-700"
      style={{ height: 'calc(100% - 48px)' }}
    >
      <UserInfo />
      <UserMenu />
      <div className="grow"></div>
      <div className="border-t border-gray-300 p-4 dark:border-gray-900">
        <FooterMessage
          isShowFooter={enabledFeatures.has('footer')}
          isShowRequestApiKey={enabledFeatures.has('request-api-key')}
          isShowReportAnIssue={enabledFeatures.has('report-an-issue')}
          footerHtmlMessage={footerHtmlMessage}
        />
      </div>
    </div>
  );
};
