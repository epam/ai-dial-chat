import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { FeatureType } from '@epam/ai-dial-shared';
import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

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
  const addButtonLabel = t(MarketplaceI18nKeys.AddLabel, { label });

  const [isOpen, setIsOpen] = useState(false);

  const screenState = useScreenState();
  const isScreenSmall = screenState === ScreenState.SM;

  const visibleActions = useMemo(() => {
    return menuItems.filter((item) => item.display);
  }, [menuItems]);

  if (!visibleActions.length) return null;

  if (visibleActions.length === 1)
    return (
      <DialPrimaryButton
        onClick={visibleActions[0].onClick}
        label={addButtonLabel}
        iconBefore={<IconPlus size={18} />}
        className="shrink-0"
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
        <DialPrimaryButton
          data-qa={dataQa}
          label={
            isScreenSmall
              ? t(MarketplaceI18nKeys.AddMarketplace)
              : addButtonLabel
          }
          className="shrink-0"
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
