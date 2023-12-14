import { IconCheck } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

export default function SearchFilterRenderer({
  customTriggerData: isSelected,
  onClick,
  highlightColor,
  dataQa,
  ...props
}: CustomTriggerMenuRendererProps) {
  const [checked, setChecked] = useState(isSelected);
  const handleCheck = useCallback(() => {
    setChecked((check: boolean) => !check);
    onClick && onClick(!checked);
  }, [onClick, checked]);

  return (
    <div
      className="relative flex h-[34px] w-full px-3 py-2 group-hover/file-item:flex"
      data-qa={dataQa}
    >
      <input
        id={dataQa}
        className={classNames(
          'checkbox peer h-[18px] w-[18px] cursor-pointer bg-gray-100 dark:bg-gray-700 checked:dark:border-green',
          getByHighlightColor(
            highlightColor,
            'checked:border-green hover:border-green  checked:dark:border-green',
            'checked:border-violet hover:border-violet checked:dark:border-violet',
          ),
        )}
        type="checkbox"
        checked={checked}
        onChange={handleCheck}
      />
      <IconCheck
        size={18}
        className={classNames(
          'pointer-events-none invisible absolute text-green peer-checked:visible',
          getByHighlightColor(highlightColor, 'text-green', 'text-violet'),
        )}
      />
      <label className=" cursor-pointer" htmlFor={dataQa}>
        {props.name}
      </label>
    </div>
  );
}
