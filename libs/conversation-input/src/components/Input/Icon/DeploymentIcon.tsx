import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './DeploymentIcon.module.scss';

interface Props {
  src: string;
  size: number;
  fallback: ReactNode;
}
/**
 * Renders a deployment icon inside a white rounded badge.
 * The `size` prop is the outer badge dimension in pixels.
 * The icon image is inset by ~11 % (matching Figma) to leave a visible backdrop.
 * On image load error the `fallback` node is rendered centred inside the same badge.
 */
export const DeploymentIcon: FC<Props> = ({ src, size, fallback }) => {
  const [hasFailed, setHasFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setHasFailed(true);
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [src]);

  // ~11 % inset matches the Figma "inset-[11.11%]" applied to the icon inside its badge
  const padding = Math.round(size * 0.111);

  return (
    <div
      style={{ width: size, height: size }}
      className={mergeClasses(
        styles.agentIconBadge,
        'shrink-0 overflow-hidden rounded-full',
      )}
    >
      {hasFailed ? (
        <div className="flex size-full items-center justify-center">
          {fallback}
        </div>
      ) : (
        <div style={{ padding }} className="size-full">
          <img
            ref={ref}
            src={src}
            alt=""
            className="size-full object-contain"
          />
        </div>
      )}
    </div>
  );
};
