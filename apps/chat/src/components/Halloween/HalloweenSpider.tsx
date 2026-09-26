import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, useId, type FC, type SVGProps } from 'react';

interface Props extends Pick<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  className?: string;
}

const LEGS = [
  'M27 25Q21 22 18 14L9 5L6 7',
  'M26 28L15 22Q11 19 4 19L2 23',
  'M26 31L15 32L5 39L4 44',
  'M28 34L21 41L17 53L14 56',
  'M37 25Q43 22 46 14L55 5L58 7',
  'M38 28L49 22Q53 19 60 19L62 23',
  'M38 31L49 32L59 39L60 44',
  'M36 34L43 41L47 53L50 56',
];

/** Glossy segmented body, jointed legs and amber eyes that read at corner size. */
const HalloweenSpider: FC<Props> = ({ className, ...size }) => {
  const id = useId();

  return (
    <svg
      {...size}
      viewBox="0 0 64 60"
      className={mergeClasses('h-10 w-auto drop-shadow-sm', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="32%" cy="22%" r="80%">
          <stop stopColor="#757180" />
          <stop offset="0.4" stopColor="#35313e" />
          <stop offset="0.85" stopColor="#15131d" />
          <stop offset="1" stopColor="#09090e" />
        </radialGradient>
        <linearGradient id={`${id}-legs`} x2="0.8" y2="1">
          <stop stopColor="#8d8291" />
          <stop offset="0.45" stopColor="#39313f" />
          <stop offset="1" stopColor="#16121e" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {LEGS.map((leg) => (
          <path
            key={leg}
            d={leg}
            stroke={`url(#${id}-legs)`}
            strokeWidth="2.4"
          />
        ))}
        <path
          d="M18 14L21 21M15 22L23 27M15 32L22 32M21 41L26 35M46 14L43 21M49 22L41 27M49 32L42 32M43 41L38 35"
          stroke="#d2b7bf"
          strokeOpacity="0.35"
          strokeWidth="0.7"
        />
      </g>
      <ellipse
        cx="32"
        cy="37"
        rx="11"
        ry="15"
        fill={`url(#${id}-body)`}
        stroke="#a89ba9"
        strokeOpacity="0.4"
        strokeWidth="0.8"
      />
      <path
        d="M29 29L35 29L32 35L36 43L28 43L32 35Z"
        fill="#bd542e"
        opacity="0.8"
      />
      <path
        d="M25 33C24 37 25 42 27 44"
        fill="none"
        stroke="#d8ccd7"
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <ellipse
        cx="32"
        cy="22"
        rx="9"
        ry="8"
        fill={`url(#${id}-body)`}
        stroke="#a89ba9"
        strokeOpacity="0.4"
        strokeWidth="0.8"
      />
      <path
        d="M28 16Q26 10 29 10M36 16Q38 10 35 10"
        fill="none"
        stroke="#726675"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g fill="#ffc36d" stroke="#3c1c12" strokeWidth="0.7">
        <ellipse cx="28.5" cy="20" rx="2.8" ry="3.4" />
        <ellipse cx="35.5" cy="20" rx="2.8" ry="3.4" />
        <circle cx="24.8" cy="23" r="1.25" />
        <circle cx="39.2" cy="23" r="1.25" />
      </g>
      <g fill="#16121c">
        <ellipse cx="28.8" cy="19.5" rx="1.25" ry="2" />
        <ellipse cx="35.2" cy="19.5" rx="1.25" ry="2" />
      </g>
      <g fill="#fff6d9">
        <circle cx="28" cy="18.5" r="0.75" />
        <circle cx="34.5" cy="18.5" r="0.75" />
      </g>
    </svg>
  );
};

export default memo(HalloweenSpider);
