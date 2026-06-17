import { IconChevronDown } from '@tabler/icons-react';
import { Placement } from '@floating-ui/react';
import { MouseEvent, useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { PublicationFunctions } from '@/src/types/publication';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

const getMenuPlacement = (): Placement =>
  typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
    ? 'bottom-end'
    : 'bottom-start';

interface FilterTypeProps {
  id: string;
  filters: string[];
  selectedFilter: string;
  formattingFunction?: (filterType: string) => string;
  onChangeFilter: (filterType: PublicationFunctions) => void;
  menuClassName?: string;
  triggerClassName?: string;
  /** When set, menu open state is controlled by the parent. */
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
}

export function RulesSelect({
  id,
  filters,
  selectedFilter,
  onChangeFilter,
  menuClassName,
  triggerClassName,
  formattingFunction,
  isMenuOpen,
  onMenuOpenChange,
}: FilterTypeProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<Placement>('bottom-start');
  const isControlled = isMenuOpen !== undefined;
  const menuOpen = isControlled ? isMenuOpen : internalOpen;

  useEffect(() => {
    const syncPlacement = () => setMenuPlacement(getMenuPlacement());
    syncPlacement();
    const observer = new MutationObserver(syncPlacement);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    });
    return () => observer.disconnect();
  }, []);

  const handleOpenChange = useCallback(
    (opened: boolean) => {
      if (!isControlled) {
        setInternalOpen(opened);
      }
      onMenuOpenChange?.(opened);
    },
    [isControlled, onMenuOpenChange],
  );

  const selectedFilterLabel = formattingFunction
    ? formattingFunction(selectedFilter)
    : startCase(toLower(selectedFilter));

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onChangeFilter(e.currentTarget.value as PublicationFunctions);
    handleOpenChange(false);
  };

  return (
    <Menu
      className={classNames('w-full grow bg-layer-3', menuClassName)}
      placement={menuPlacement}
      {...(isControlled ? { isMenuOpen } : {})}
      onOpenChange={handleOpenChange}
      listClassName="rounded-none w-full"
      trigger={
        <div
          data-qa={`filter-selector-${id}`}
          className={classNames(
            'flex w-full items-center gap-2 px-2 py-[6.5px] text-xs',
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-start">
            {selectedFilterLabel}
          </span>
          <IconChevronDown
            data-qa={`open-filter-dropdown-${id}`}
            className={classNames(
              'shrink-0 text-primary transition-all',
              menuOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      <div className="w-full bg-layer-3">
        {filters.map((filterType) => (
          <MenuItem
            key={filterType}
            className="max-w-full text-xs hover:bg-accent-primary-alpha"
            item={
              formattingFunction
                ? formattingFunction(filterType)
                : startCase(toLower(filterType))
            }
            value={filterType}
            onClick={onChangeHandler}
          />
        ))}
      </div>
    </Menu>
  );
}
