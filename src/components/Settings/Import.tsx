import { FC, ReactNode, useRef } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';

interface Props {
  onImport: (importJSON: any) => void;
  icon: ReactNode;
  highlightColor: HighlightColor;
}

export const Import: FC<Props> = ({ onImport, icon, highlightColor }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json"
        onChange={(e) => {
          if (!e.target.files?.length) return;

          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const json = JSON.parse(readerEvent.target?.result as string);
            onImport(json);
            (ref.current as unknown as HTMLInputElement).value = '';
          };
          reader.readAsText(file);
        }}
      />
      <div
        className={classNames(
          'flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded',
          getByHighlightColor(
            highlightColor,
            'hover:bg-green/15 hover:text-green',
            'hover:bg-violet/15 hover:text-violet',
          ),
        )}
        onClick={() => {
          const importFile = ref.current;
          if (importFile) {
            importFile.click();
          }
        }}
        data-qa="import"
      >
        {icon}
      </div>
    </>
  );
};
