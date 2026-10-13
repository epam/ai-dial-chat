import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconPlayerPlay } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomViewerI18nKeys } from '../../constants/translation-keys';

interface Props {
  /** The viewer's title, shown in the button label. */
  viewerTitle: string;
  /** Called when the user chooses to start working with the viewer. */
  onStart: () => void;
}

const CustomViewerStartGate: FC<Props> = ({ viewerTitle, onStart }) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center px-4 py-3">
      <PrimaryButton
        label={t(CustomViewerI18nKeys.StartWorking, { viewerTitle })}
        iconBefore={
          <IconPlayerPlay
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            className="rtl:scale-x-[-1]"
            aria-hidden
          />
        }
        onClick={onStart}
      />
    </div>
  );
};

export default memo(CustomViewerStartGate);
