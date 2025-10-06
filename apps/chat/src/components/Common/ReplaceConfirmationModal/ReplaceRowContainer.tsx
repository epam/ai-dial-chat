import { ReactNode } from 'react';

interface FeatureContainerProps {
  children: ReactNode | ReactNode[];
}

export const FeatureContainer = ({ children }: FeatureContainerProps) => (
  <span className="flex w-2/3 flex-row items-center gap-2">{children}</span>
);
