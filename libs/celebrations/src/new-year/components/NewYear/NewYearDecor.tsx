import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostIconButton } from '@epam/ai-dial-ui-kit';
import { memo, useId, type FC } from 'react';
import { CELEBRATIONS_CLASS } from '../../../constants/public-class-names';
import { useCelebrationEnvironment } from '../../../context/CelebrationEnvironmentContext';
import type { CelebrationDecorationProps } from '../../../models/celebration';
import { NEW_YEAR_LABELS } from '../../constants/labels';
import styles from './NewYear.module.scss';

const Gift: FC = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-box`} x2="0.8" y2="1">
          <stop stopColor="#477f81" />
          <stop offset="0.48" stopColor="#23575d" />
          <stop offset="1" stopColor="#123b4b" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`} x2="0.4" y2="1">
          <stop stopColor="#ffefb5" />
          <stop offset="0.55" stopColor="#e9b85d" />
          <stop offset="1" stopColor="#a96b28" />
        </linearGradient>
      </defs>
      <ellipse cx="51" cy="91" rx="34" ry="5" fill="#173b4826" />
      <path
        d="M17 44H83V82Q83 88 77 88H23Q17 88 17 82Z"
        fill={`url(#${id}-box)`}
        stroke="#85b4b0"
        strokeWidth="0.8"
      />
      <path d="M42 44H58V88H42Z" fill={`url(#${id}-ribbon)`} />
      <path
        d="M18 55H82"
        stroke="#071f38"
        strokeOpacity="0.35"
        strokeWidth="3"
      />
      <g className={styles.giftLid}>
        <path
          d="M51 31Q14 36 23 13Q31 3 51 31Z"
          fill={`url(#${id}-ribbon)`}
          stroke="#fbe0a1"
          strokeWidth="0.9"
        />
        <path
          d="M49 31Q86 36 77 13Q69 3 49 31Z"
          fill={`url(#${id}-ribbon)`}
          stroke="#fbe0a1"
          strokeWidth="0.9"
        />
        <path
          d="M46 28Q27 28 29 17Q33 14 46 28M54 28Q73 28 71 17Q67 14 54 28"
          fill="#aa732f"
        />
        <rect
          x="12"
          y="32"
          width="76"
          height="19"
          rx="4"
          fill={`url(#${id}-box)`}
          stroke="#9ac7bd"
          strokeWidth="0.8"
        />
        <path d="M41 32H59V51H41Z" fill={`url(#${id}-ribbon)`} />
        <rect x="44" y="26" width="12" height="9" rx="4" fill="#edc677" />
      </g>
      <path
        d="M27 62L29 68L35 70L29 72L27 78L25 72L19 70L25 68Z"
        fill="#a6ddd1"
        opacity="0.65"
      />
      <path
        d="M73 60L75 65L80 67L75 69L73 74L71 69L66 67L71 65Z"
        fill="#a6ddd1"
        opacity="0.55"
      />
    </svg>
  );
};

/** A small garland and gift occupy the existing seasonal decoration slot. */
const NewYearDecor: FC<CelebrationDecorationProps> = ({ onActivate }) => {
  const { labels } = useCelebrationEnvironment();
  return (
    <>
      <svg
        className={styles.garland}
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M0 5Q150 72 300 5Q450 72 600 5Q750 72 900 5Q1050 72 1200 5"
          fill="none"
          stroke="#638879"
          strokeWidth="1.1"
        />
        {Array.from({ length: 24 }, (_, index) => {
          const x = 25 + index * 50;
          const local = (x % 300) / 300;
          const y = 5 + 134 * local * (1 - local);
          return (
            <ellipse
              key={index}
              cx={x}
              cy={y + 5}
              rx="3"
              ry="5"
              fill={['#d8b775', '#83beb2', '#c89490'][index % 3]}
            />
          );
        })}
      </svg>
      <div className="absolute bottom-2 end-2 desktop:bottom-4 desktop:end-4">
        <GhostIconButton
          className={mergeClasses(
            styles.giftButton,
            CELEBRATIONS_CLASS.trigger,
          )}
          icon={<Gift />}
          aria-label={labels.giftLabel ?? NEW_YEAR_LABELS.giftLabel}
          onClick={onActivate}
        />
      </div>
    </>
  );
};

export default memo(NewYearDecor);
