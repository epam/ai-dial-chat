import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CitationsI18nKeys } from '../../../constants/translation-keys';

interface Props {
  /** Human-readable source name derived from the attachment URL. */
  sourceName: string;
  /** Total number of annotations in this citation group. */
  annotationCount: number;
  /** Called when the user clicks the marker to open the citation popup. */
  onOpen: () => void;
}

const CitationMarker: FC<Props> = ({ sourceName, annotationCount, onOpen }) => {
  const { t } = useTranslation();

  const label =
    annotationCount > 1
      ? t(CitationsI18nKeys.MarkerLabelWithOverflow, {
          source: sourceName,
          count: annotationCount - 1,
        })
      : t(CitationsI18nKeys.MarkerLabel, { source: sourceName });

  return (
    <DialButton
      variant={ButtonVariant.Neutral}
      appearance={ButtonAppearance.Outlined}
      size={ElementSize.Small}
      label={label}
      aria-label={t(CitationsI18nKeys.MarkerAriaLabel, { source: sourceName })}
      onClick={onOpen}
    />
  );
};

export default memo(CitationMarker);
