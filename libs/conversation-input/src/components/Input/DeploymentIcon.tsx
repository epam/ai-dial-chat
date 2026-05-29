import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';

/** Renders a deployment icon image with a fallback when the image fails to load. */
export const DeploymentIcon: FC<{
  src: string;
  size: number;
  fallback: ReactNode;
}> = ({ src, size, fallback }) => {
  const [hasFailed, setHasFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setHasFailed(true);
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [src]);

  if (hasFailed) return <>{fallback}</>;
  return <img ref={ref} src={src} alt="" width={size} height={size} />;
};
