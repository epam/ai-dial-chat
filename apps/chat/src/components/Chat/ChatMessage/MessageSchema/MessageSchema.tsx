import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { withErrorBoundary } from '@/src/components/Common/ErrorBoundary';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

import { AssistantSchema as MemoAssistantSchema } from './AssistantSchema';
import { UserSchema as MemoUserSchema } from './UserSchema';

const InvalidSchemaMessage = () => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="mt-2">
      <ErrorMessage error={t('Form schema is invalid')} />
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
