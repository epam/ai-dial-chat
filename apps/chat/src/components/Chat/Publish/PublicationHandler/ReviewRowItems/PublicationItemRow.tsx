import { ReactNode, useCallback } from 'react';

import classNames from 'classnames';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';

interface PublicationRowProps {
  level: number;
  editedName: string;
  isEditable: boolean;
  name: string;
  Icon: ReactNode;
  publicationInfo?: {
    isNotExist?: boolean;
    action?: PublishActions;
  };
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  isEditable,
  editedName,
  name,
  Icon,
  publicationInfo,
}) => {
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    (e: React.ChangeEvent<HTMLInputElement>) => {},
    [],
  );

  return (
    <span
      className="relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center gap-2 rounded px-4"
      style={{
        paddingLeft: `${level * 24 + 16}px`,
      }}
    >
      <span className="flex shrink-0">{Icon}</span>
      {isEditable ? (
        <div className="block flex-1 truncate whitespace-pre break-all text-left text-primary">
          <input
            className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
            value={editedName}
            onChange={handleChange}
          />
        </div>
      ) : (
        <Tooltip
          tooltip={name}
          contentClassName="max-w-[400px] break-all"
          triggerClassName={classNames(
            'truncate whitespace-pre',
            publicationInfo?.isNotExist && 'text-secondary',
            publicationInfo?.action === PublishActions.DELETE && 'text-error',
          )}
          dataQa="entity-name"
        >
          {name}
        </Tooltip>
      )}
    </span>
  );
};
