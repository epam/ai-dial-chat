import { IconFileDescription } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

interface CodeEditorFileTreeEmptyStateProps {
  onCreateFile: () => void;
}

export const CodeEditorFileTreeEmptyState = ({
  onCreateFile,
}: CodeEditorFileTreeEmptyStateProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex grow flex-col items-center justify-center p-3 text-center">
      <IconFileDescription
        className="text-secondary"
        size={60}
        strokeWidth={0.5}
      />
      <span className="mt-3 text-sm">
        {t(ChatI18nKeys.YouDontHaveAnyFiles)}
      </span>
      <DialLinkButton
        className="mt-2"
        label={t(ChatI18nKeys.CreateFile)}
        onClick={onCreateFile}
      />
    </div>
  );
};
