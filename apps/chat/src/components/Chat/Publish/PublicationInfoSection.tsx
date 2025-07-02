import { IconHelp } from '@tabler/icons-react';
import { ReactNode } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ErrorTooltip } from '@/src/components/Common/ErrorTooltip';
import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  labelDataQa: string;
  label: string;
  valueDataQa: string;
  valueToDisplay: ReactNode;
  tooltip?: ReactNode;
  infoTooltip?: string;

  // Edit mode
  isEditMode?: boolean;
  inputClassName?: string;
  editValue?: string;
  errors?: string[];
  onChangeValue?: (value: string) => void;
}
export function PublicationInfoSection({
  labelDataQa,
  label,
  valueDataQa,
  valueToDisplay,
  tooltip,
  infoTooltip,

  isEditMode,
  inputClassName,
  editValue,
  errors,
  onChangeValue,
}: Props) {
  const isErrors = !!errors?.length;
  const { t } = useTranslation(Translation.Chat);

  return (
    <section className="mb-3">
      <h3
        className="flex flex-row items-center gap-1 text-xs text-secondary"
        data-qa={labelDataQa}
      >
        {label}
        {infoTooltip && (
          <Tooltip
            tooltip={infoTooltip}
            triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
            contentClassName="max-w-[220px]"
            placement="top"
          >
            <IconHelp size={18} />
          </Tooltip>
        )}
      </h3>

      {isEditMode && (
        <div className="relative flex flex-row">
          <input
            className={classNames(
              'h-6 w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none',
              isErrors && '!border-b-error pr-5',
              inputClassName,
            )}
            value={editValue}
            onChange={(e) => onChangeValue?.(e.target.value)}
          />

          <ErrorTooltip
            hideTooltip={!isErrors}
            tooltip={(errors ?? []).map((error) => (
              <p key={error}>{t(error)}</p>
            ))}
            triggerClassName="h-6 absolute right-1 top-1/2 -translate-y-[7px]"
          />
        </div>
      )}
      {!isEditMode &&
        (tooltip ? (
          <Tooltip
            contentClassName="max-w-[400px] break-all my-1 text-sm"
            triggerClassName="truncate whitespace-pre"
            tooltip={<div className="flex break-words">{tooltip}</div>}
            dataQa={valueDataQa}
          >
            <span className="w-full">{valueToDisplay}</span>
          </Tooltip>
        ) : (
          <span className="w-full" data-qa={valueDataQa}>
            {valueToDisplay}
          </span>
        ))}
    </section>
  );
}
