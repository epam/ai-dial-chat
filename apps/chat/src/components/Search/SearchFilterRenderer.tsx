import { IconCheck } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

export default function SearchFilterRenderer({
  customTriggerData: isSelected,
  onClick,
  dataQa,
  ...props
}: CustomTriggerMenuRendererProps) {
  const [checked, setChecked] = useState<boolean>(!!isSelected);
  const handleCheck = useCallback(() => {
    setChecked((check: boolean) => !check);
    const clickHandler = onClick as (props: boolean) => void;
    clickHandler && clickHandler(!checked);
  }, [onClick, checked]);

  return (
    <div
      className="relative flex h-[34px] w-full px-3 py-2 group-hover/file-item:flex"
      data-qa={dataQa}
    >
      <input
        id={dataQa}
        className={classNames('checkbox peer size-[18px] cursor-pointer')}
        type="checkbox"
        checked={checked}
        onChange={handleCheck}
      />
      <IconCheck
        size={18}
        className={classNames(
          'pointer-events-none invisible absolute peer-checked:visible',
          'text-accent-primary',
        )}
      />
      <label className="cursor-pointer whitespace-pre" htmlFor={dataQa}>
        {props.name}
      </label>
    </div>
  );
}
