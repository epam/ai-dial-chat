import { ErrorAlert } from '@epam/ai-dial-chat-shared';
import type { ParseKeys } from 'i18next';
import { memo, type FC } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import {
  ErrorBoundaryI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';

interface Props extends FallbackProps {
  actionLabel?: ParseKeys<'translation'>;
}

const ErrorFallback: FC<Props> = ({
  error: _,
  resetErrorBoundary,
  actionLabel,
}) => {
  const { t } = useTranslation();

  return (
    <ErrorAlert
      onAction={resetErrorBoundary}
      labels={{
        heading: t(ErrorBoundaryI18nKeys.Heading),
        message: t(ErrorBoundaryI18nKeys.Description),
        actionLabel: t(actionLabel ?? ButtonsI18nKeys.TryAgain),
      }}
    />
  );
};

export default memo(ErrorFallback);
