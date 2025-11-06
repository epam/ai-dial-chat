import { Component, ComponentType, ReactNode, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  config?: {
    errorLogMessage?: string;
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
}

interface DefaultFallbackComponentProps {
  onClick: () => void;
}

function DefaultFallbackComponent({ onClick }: DefaultFallbackComponentProps) {
  const { t } = useTranslation(Translation.Chat);
  const handleBack = useCallback(() => {
    onClick();
  }, [onClick]);

  return (
    <div className="w-fit p-6">
      <h2 className="text-lg">{t('Oops, something went wrong...')}</h2>
      <button
        className="button button-secondary"
        type="button"
        onClick={handleBack}
      >
        {t('Back')}
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.resetErrorState = this.resetErrorState.bind(this);
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (this.props.config?.errorLogMessage) {
      console.error(this.props.config.errorLogMessage, ': ', error);
    }
  }

  resetErrorState = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultFallbackComponent onClick={this.resetErrorState} />
        )
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<T extends object>(
  Component: ComponentType<T>,
  fallback?: ReactNode,
  config?: ErrorBoundaryProps['config'],
) {
  const ErrorBoundaryWrapper = (props: T) => (
    <ErrorBoundary fallback={fallback} config={config}>
      <Component {...props} />
    </ErrorBoundary>
  );

  ErrorBoundaryWrapper.displayName = 'ErrorBoundaryWrapper';

  return ErrorBoundaryWrapper;
}
