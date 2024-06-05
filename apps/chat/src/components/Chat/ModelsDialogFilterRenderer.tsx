import { IconCheck } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

interface ModelsDialogFilterData {
  isSelected: boolean;
  type: string;
}

export default function ModelsDialogFilterRenderer({
  customTriggerData,
  onClick,
  dataQa,
  ...props
}: CustomTriggerMenuRendererProps) {
  const { isSelected, type } = customTriggerData as ModelsDialogFilterData;
  const [checked, setChecked] = useState<boolean>(isSelected);
  const handleCheck = useCallback(() => {
    setChecked((check: boolean) => !check);
    const clickHandler = onClick as (type: string) => void;
    clickHandler && clickHandler(type);
  }, [onClick, checked]);

  return (
    <div
      className="relative flex h-[34px] w-full bg-layer-2 px-3 py-2 text-primary-bg-light group-hover/file-item:flex"
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
          'text-pr-primary-700',
        )}
      />
      <label className="cursor-pointer whitespace-pre" htmlFor={dataQa}>
        {props.name}
      </label>
    </div>
  );
}
