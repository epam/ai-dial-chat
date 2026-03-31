import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { withErrorBoundary } from '@/src/components/Common/ErrorBoundary';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

import { AssistantSchema as MemoAssistantSchema } from './AssistantSchema';
import { UserSchema as MemoUserSchema } from './UserSchema';

const InvalidSchemaMessage = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="mt-2">
      <ErrorMessage error={t(ChatI18nKeys.FormSchemaInvalid)} />
    </div>
  );
};

export const UserSchema = withErrorBoundary(
  MemoUserSchema,
  <InvalidSchemaMessage />,
);

export const AssistantSchema = withErrorBoundary(
  MemoAssistantSchema,
  <InvalidSchemaMessage />,
);
