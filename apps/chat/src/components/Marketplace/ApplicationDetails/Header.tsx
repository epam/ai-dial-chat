import {
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandX,
  IconLink,
  IconShare,
} from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { Menu } from '../../Common/DropdownMenu';

interface Props {
  application: {
    tags: string[];
    title: string;
    avatar: string;
  };
}

const src = 'https://i.pravatar.cc/300?img=3';

const contextMenuItems = [
  { BrandIcon: IconLink, text: translate('Copy link') },
  { BrandIcon: IconBrandFacebook, text: translate('Share via Facebook') },
  { BrandIcon: IconBrandX, text: translate('Share via X') },
  { BrandIcon: IconBrandLinkedin, text: translate('Share via LinkedIn') },
];

export const ApplicationDetailsHeader = ({ application }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

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
            {application.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border-[1px] border-accent-primary bg-accent-primary-alpha px-1.5 py-1 text-xs leading-3"
              >
                {tag}
              </span>
            ))}
          </div>
          <Menu
            listClassName="bg-layer-1 !z-[60] w-[290px]"
            placement="bottom-end"
            type="contextMenu"
            trigger={
              <button className="hidden items-center gap-3 text-accent-primary md:flex">
                <IconShare size={18} />
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
                {contextMenuItems.map(({ BrandIcon, text }) => (
                  <button
                    key={text}
                    className="flex w-full items-center gap-3 px-3 py-2 hover:bg-accent-primary-alpha"
                  >
                    <BrandIcon size={18} className="text-secondary" />
                    <span>{text}</span>
                  </button>
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
