import {
  IconBrandFacebook,
  IconBrandX,
  IconLink,
  IconShare,
  IconWorldShare,
  IconX,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isApplicationId } from '@/src/utils/app/id';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { isItemPublic } from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface Props {
  entity: DialAIEntityModel;
  onClose: () => void;
}

export const ApplicationDetailsHeader = ({ entity, onClose }: Props) => {
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
    <header className="flex gap-2 p-4 md:gap-4 md:px-6">
      <ModelIcon
        enableShrinking
        isCustomTooltip
        entity={entity}
        entityId={entity.id}
        size={isSmallScreen() ? 48 : 96}
      />
      <div className="mt-4 flex w-full flex-col gap-1 md:gap-3">
        <div className="flex justify-between">
          <div className="flex gap-2">
            {/* {application.tags.map((tag) => (
              <ApplicationTag key={tag} tag={tag} />
            ))} */}
            <h2 className="text-lg font-semibold leading-[18px] md:text-xl md:leading-6">
              {entity.name}
            </h2>
          </div>
          <div className="flex items-center gap-5">
            <Menu
              listClassName="bg-layer-1 !z-[60] w-[290px]"
              placement="bottom-end"
              type="contextMenu"
              data-qa="application-share-type-select"
              trigger={
                <button className="hidden items-center gap-3 text-accent-primary md:flex">
                  {isApplicationId(entity.id) && !isItemPublic(entity.id) ? (
                    <>
                      <IconWorldShare
                        size={18}
                        className="shrink-0 cursor-pointer text-accent-primary"
                      />
                      <span className="font-semibold">{t('Publish')}</span>
                    </>
                  ) : (
                    <>
                      <IconShare className="[&_path]:fill-current" size={18} />
                      <span className="font-semibold">{t('Share')}</span>
                    </>
                  )}
                </button>
              }
            >
              <div className="divide-y divide-primary">
                <div className="flex items-center gap-2 px-3 py-4">
                  <ModelIcon
                    isCustomTooltip
                    entity={entity}
                    entityId={entity.id}
                    size={24}
                  />
                  <h5 className="text-xl">{entity.name}</h5>
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
            <button
              className="text-secondary hover:text-accent-primary"
              onClick={onClose}
            >
              <IconX size={24} />
            </button>
          </div>
        </div>
        {/* <h2 className="text-lg font-semibold leading-[18px] md:text-xl md:leading-6">
          {application.title}
        </h2> */}
      </div>
    </header>
  );
};
