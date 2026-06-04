import {
  DialConfirmationPopup,
  DialFormItem,
  DialSelect,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { currentTheme, themes, setTheme, isLoading } = useTheme();
  const [pendingTheme, setPendingTheme] = useState(currentTheme);

  const options = useMemo(
    () =>
      (themes ?? []).map((theme) => ({
        value: theme.id,
        label: theme.displayName,
      })),
    [themes],
  );

  const handleConfirm = () => {
    setTheme(pendingTheme);
    onClose();
  };

  return (
    <DialConfirmationPopup
      open={open}
      header={t(SettingsI18nKeys.Title)}
      confirmLabel={t(SettingsI18nKeys.Apply)}
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="px-6 py-4">
        <DialFormItem label={t(SettingsI18nKeys.Theme)}>
          <DialSelect
            options={options}
            value={pendingTheme}
            disabled={isLoading}
            onChange={(next) => setPendingTheme(next as string)}
          />
        </DialFormItem>
      </div>
    </DialConfirmationPopup>
  );
};

export default memo(SettingsModal);
