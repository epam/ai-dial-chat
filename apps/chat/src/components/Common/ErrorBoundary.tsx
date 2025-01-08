import { Component, ComponentType, ReactNode } from 'react';

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

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (this.props.config?.errorLogMessage) {
      console.error(this.props.config.errorLogMessage, ': ', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? this.props.children;
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
