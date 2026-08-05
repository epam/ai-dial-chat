import { IconAlertTriangle } from '@tabler/icons-react';
import type { ParseKeys } from 'i18next';
import { memo, type FC } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ErrorBoundaryI18nKeys } from '../../constants/translation-keys';
import AlertShell from '../AlertShell/AlertShell';

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
    <AlertShell
      icon={
        <IconAlertTriangle
          aria-hidden="true"
          size={48}
          stroke={1.5}
          className="text-error"
        />
      }
      heading={t(ErrorBoundaryI18nKeys.Heading)}
      message={t(ErrorBoundaryI18nKeys.Description)}
      actionLabel={t(actionLabel ?? ErrorBoundaryI18nKeys.RetryLabel)}
      onAction={resetErrorBoundary}
    />
  );
};

export default memo(ErrorFallback);
