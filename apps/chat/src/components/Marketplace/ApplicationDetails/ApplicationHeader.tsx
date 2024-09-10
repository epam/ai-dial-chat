import {
  IconBrandFacebook,
  IconBrandX,
  IconLink,
  IconShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface Props {
  application: {
    tags: string[];
    title: string;
    avatar: string;
  };
}

const src = 'https://i.pravatar.cc/300?img=3';

export const ApplicationDetailsHeader = ({ application }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const contextMenuItems = useMemo(
    () => [
      {
        BrandIcon: IconLink,
        text: translate('Copy link'),
        onClick: () => {
          dispatch(UIActions.showInfoToast(t('Link copied')));
        },
      },
      {
        BrandIcon: IconBrandFacebook,
        text: translate('Share via Facebook'),
        onClick: () => {
          const shareUrl = encodeURIComponent(window.location.href); // link to app
          window.open(`https://m.me/?link=${shareUrl}`, '_blank');
        },
      },
      {
        BrandIcon: IconBrandX,
        text: translate('Share via X'),
        onClick: () => {
          const shareUrl = encodeURIComponent(window.location.href); // link to app
          window.open(
            `https://twitter.com/messages/compose?text=${shareUrl}`,
            '_blank',
          );
        },
      },
    ],
    [dispatch, t],
  );

  return (
    <header className="flex items-center gap-2 p-4 md:gap-4 md:px-6">
      <Image
        src={application.avatar}
        alt={t('application icon')}
        height={isSmallScreen() ? 48 : 96}
        width={isSmallScreen() ? 48 : 96}
        className="shrink-0 rounded-full"
      />
      <div className="flex w-full flex-col gap-1 md:gap-3">
        <div className="flex justify-between">
          <div className="flex gap-2">
            {/* {application.tags.map((tag) => (
              <ApplicationTag key={tag} tag={tag} />
            ))} */}
          </div>
          <Menu
            listClassName="bg-layer-1 !z-[60] w-[290px]"
            placement="bottom-end"
            type="contextMenu"
            data-qa="application-share-type-select"
            trigger={
              <button className="hidden items-center gap-3 text-accent-primary md:flex">
                <IconShare className="[&_path]:fill-current" size={18} />
                <span className="font-semibold">{t('Share')}</span>
              </button>
            }
          >
            <div className="divide-y divide-primary">
              <div className="flex items-center gap-2 px-3 py-4">
                <Image
                  src={src}
                  alt={t('application context menu icon')}
                  height={24}
                  width={24}
                  className="shrink-0 rounded-full"
                />
                <h5 className="text-xl">{application.title}</h5>
              </div>
              <div>
                {contextMenuItems.map(({ BrandIcon, text, ...props }) => (
                  <MenuItem
                    key={text}
                    item={
                      <>
                        <BrandIcon size={18} className="text-secondary" />
                        <span>{text}</span>
                      </>
                    }
                    className="flex w-full items-center gap-3 px-3 py-2 hover:bg-accent-primary-alpha"
                    {...props}
                  />
                ))}
              </div>
            </div>
          </Menu>
        </div>
        <h2 className="text-lg font-semibold leading-[18px] md:text-xl md:leading-6">
          {application.title}
        </h2>
      </div>
    </header>
  );
};
