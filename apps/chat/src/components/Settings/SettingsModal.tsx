import {
  DialConfirmationPopup,
  DialFormItem,
  DialSelect,
} from '@epam/ai-dial-ui-kit';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
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
      <div className="p-4">
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
}
