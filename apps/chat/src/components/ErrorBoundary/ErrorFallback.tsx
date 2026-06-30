import { PrimaryButton } from '@epam/ai-dial-kit';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ParseKeys } from 'i18next';
import { memo, type FC } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ErrorBoundaryI18nKeys } from '../../constants/translation-keys';

interface Props extends FallbackProps {
  actionLabel?: ParseKeys<'translation'>;
}

export type { Props as ErrorFallbackProps };

const ErrorFallback: FC<Props> = ({
  error: _,
  resetErrorBoundary,
  actionLabel,
}) => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <IconAlertTriangle
        aria-hidden="true"
        size={48}
        stroke={1.5}
        className="text-error"
      />
      <h2>{t(ErrorBoundaryI18nKeys.Heading)}</h2>
      <p className="text-secondary">{t(ErrorBoundaryI18nKeys.Description)}</p>
      <PrimaryButton
        autoFocus
        label={t(actionLabel ?? ErrorBoundaryI18nKeys.RetryLabel)}
        onClick={resetErrorBoundary}
      />
    </div>
  );
};

export default memo(ErrorFallback);
