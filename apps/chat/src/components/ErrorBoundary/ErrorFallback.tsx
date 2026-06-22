import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ParseKeys } from 'i18next';
import { memo, type FC } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';

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
      <IconAlertTriangle aria-hidden="true" size={48} className="text-error" />
      <h2 className="text-xl font-semibold text-primary">
        {t('errorBoundary.heading')}
      </h2>
      <p className="text-base text-secondary">
        {t('errorBoundary.description')}
      </p>
      <DialPrimaryButton
        autoFocus
        label={t(actionLabel ?? 'errorBoundary.retryLabel')}
        onClick={resetErrorBoundary}
      />
    </div>
  );
};

export default memo(ErrorFallback);
