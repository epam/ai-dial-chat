import { NeutralButton } from '@epam/ai-dial-kit';
import { ElementSize } from '@epam/ai-dial-ui-kit';
import { FC, memo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CitationsI18nKeys } from '../../../constants/translation-keys';

interface Props {
  /** Human-readable source name derived from the attachment URL. */
  sourceName: string;
  /** Total number of annotations in this citation group. */
  annotationCount: number;
  /** Called when the user clicks the marker to open the citation popup. */
  onOpen: () => void;
  /** Optional icon rendered before the label; omitted by default. */
  icon?: ReactNode;
}

const CitationMarker: FC<Props> = ({
  sourceName,
  annotationCount,
  onOpen,
  icon,
}) => {
  const { t } = useTranslation();

  const label = (
    <span className="flex items-center gap-1">
      {icon}
      <span className="dial-caption-text">
        {annotationCount > 1
          ? t(CitationsI18nKeys.MarkerLabelWithOverflow, {
              source: sourceName,
              count: annotationCount - 1,
            })
          : t(CitationsI18nKeys.MarkerLabel, { source: sourceName })}
      </span>
    </span>
  );

  return (
    <NeutralButton
      size={ElementSize.Small}
      label={label}
      aria-label={t(CitationsI18nKeys.MarkerAriaLabel, { source: sourceName })}
      onClick={onOpen}
    />
  );
};

export default memo(CitationMarker);
