import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

interface AddMarketplaceEntityButtonProps {
  menuItems: DisplayMenuItemProps[];
  dataQa: string;
  label: string;
}

export function AddMarketplaceEntityButton({
  menuItems,
  dataQa,
  label,
}: AddMarketplaceEntityButtonProps) {
  const { t } = useTranslation(Translation.Marketplace);

  const [isOpen, setIsOpen] = useState(false);

  const screenState = useScreenState();
  const isScreenSmall = screenState === ScreenState.SM;

  const visibleActions = useMemo(() => {
    return menuItems.filter((item) => item.display);
  }, [menuItems]);

  if (!visibleActions.length) return null;

  if (visibleActions.length === 1)
    return (
      <DialButton
        onClick={visibleActions[0].onClick}
        label={t(`Add ${label}`)}
        variant={ButtonVariant.Primary}
        iconBefore={<IconPlus size={18} />}
        data-qa={dataQa}
      />
    );

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={FeatureType.Application}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom"
      TriggerCustomRenderer={
        <DialButton
          variant={ButtonVariant.Primary}
          data-qa={dataQa}
          label={isScreenSmall ? t('Add') : t(`Add ${label}`)}
          iconAfter={
            <IconChevronDown
              size={18}
              className={classNames(isOpen && 'rotate-180')}
            />
          }
        />
      }
    />
  );
}
