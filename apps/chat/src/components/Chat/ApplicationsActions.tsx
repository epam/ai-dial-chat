import { IconCaretDownFilled } from '@tabler/icons-react';

import { TFunction } from 'next-i18next';

import classNames from 'classnames';

import { getApplicationIcon } from '@/src/utils/app/applications';

import { DialAIEntityModel } from '@/src/types/models';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { PinIcon } from '@/src/icons';
import { NewConversationIcon } from '@/src/icons/NewConversationIcon';
import { UnpinIcon } from '@/src/icons/UnpinIcon';

interface Props {
  model: DialAIEntityModel;
  onCreateNewConversation: (modelId: string) => void;
  onUpdateFavoriteApp: (modelId: string, isFavorite: boolean) => void;
  t: TFunction;
  isFavoriteApp: boolean;
}

export const ApplicationsActionsList = ({
  model,
  onCreateNewConversation,
  onUpdateFavoriteApp,
  isFavoriteApp,
  t,
}: Props) => {
  const AppIcon = getApplicationIcon(model.id);

  return (
    <div className="entity-selector w-full">
      <div className="h-10 rounded-full border border-secondary bg-layer-2 shadow-primary hover:cursor-pointer hover:border-tertiary">
        <Menu
          type="contextMenu"
          listClassName="min-w-[200px]"
          className="flex w-full items-center"
          trigger={
            <div className="flex w-full cursor-pointer items-center justify-between px-2">
              <div className="flex items-center gap-2 font-medium">
                <AppIcon />
                <span>
                  {model.id === 'hr-buddy' ? model.name : t('Your Documents')}
                </span>
              </div>
              <IconCaretDownFilled
                className="text-quaternary-bg-light"
                size={12}
              />
            </div>
          }
        >
          <MenuItem
            key={'create-new-conversation'}
            className="max-w-full bg-layer-2 hover:bg-accent-secondary-alpha"
            item={
              <div className="flex items-center justify-start gap-3">
                <NewConversationIcon />
                {t('New Conversation')}
              </div>
            }
            onClick={() => onCreateNewConversation(model.id)}
          />
          <MenuItem
            key={'add-remove-from-sidebar'}
            className="max-w-full bg-layer-2 hover:bg-accent-secondary-alpha"
            item={
              <div
                className={classNames(
                  'flex items-center justify-start',
                  isFavoriteApp ? 'ml-[-2px] gap-2.5' : 'gap-3',
                )}
              >
                {isFavoriteApp ? <UnpinIcon /> : <PinIcon />}
                {isFavoriteApp
                  ? t('Remove from sidebar')
                  : t('Pin to the sidebar')}
              </div>
            }
            onClick={() => onUpdateFavoriteApp(model.id, !isFavoriteApp)}
          />
        </Menu>
      </div>
    </div>
  );
};
