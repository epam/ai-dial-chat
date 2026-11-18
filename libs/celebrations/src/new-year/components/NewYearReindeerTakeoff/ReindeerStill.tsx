import { type FC, useId } from 'react';
import { REINDEER_PALETTE as P } from '../../utils/reindeer-art';

/** A freed golden loop on the calf's nose beside the adult still bracing for a pull. */
export const ReindeerStill: FC = () => {
  const artworkId = useId();
  return (
    <svg viewBox="0 0 300 170" focusable="false" data-reindeer-static>
      <defs>
        <linearGradient
          id={`${artworkId}-body`}
          gradientUnits="userSpaceOnUse"
          x1="-18"
          y1="-90"
          x2="0"
          y2="-39"
        >
          <stop stopColor={P.light} />
          <stop offset=".52" stopColor={P.fur} />
          <stop offset="1" stopColor={P.shade} />
        </linearGradient>
        <linearGradient
          id={`${artworkId}-head`}
          gradientUnits="userSpaceOnUse"
          x1="-8"
          y1="-24"
          x2="-6"
          y2="25"
        >
          <stop stopColor={P.light} />
          <stop offset=".52" stopColor={P.fur} />
          <stop offset="1" stopColor={P.shade} />
        </linearGradient>
      </defs>
      <path
        d="M14 154H268"
        stroke={P.ice}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[false, true].map((isCalf) => (
        <g
          key={String(isCalf)}
          transform={
            isCalf
              ? 'translate(84 152) scale(-.68 .68)'
              : 'translate(187 152) rotate(7) scale(.9)'
          }
          stroke={P.shade}
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path
            d="M-35-58L-43-30L-44-2M22-58L34-32L39-2"
            fill="none"
            strokeWidth="8"
            stroke={P.shade}
          />
          <path
            d="M-52-62C-54-82-34-90-5-83Q18-102 36-77Q42-53 13-44Q-4-43-15-47Q-47-33-52-62Z"
            fill={`url(#${artworkId}-body)`}
          />
          <path
            d="M20-85Q39-87 37-64Q33-50 24-47L12-52Z"
            fill={P.cream}
            stroke="none"
          />
          <path
            d={
              isCalf
                ? 'M5-70Q17-91 29-104Q43-113 48-97Q46-73 32-50L15-54Z'
                : 'M5-70Q17-91 29-111Q44-119 48-97Q46-73 32-50L15-54Z'
            }
            fill={`url(#${artworkId}-body)`}
            stroke="none"
          />
          <path
            d="M38-101Q52-105 44-79Q39-61 28-50Q24-66 33-84Z"
            fill={P.cream}
            stroke="none"
          />
          <path d="M47-97Q46-72 30-51" fill="none" strokeWidth="1.1" />
          <path
            d="M-30-57L-25-28L-30-2M27-56L20-28L15-2"
            fill="none"
            stroke={P.light}
            strokeWidth="7"
          />
          <path
            d="M-47-3H-38M35-3H44M-34-3H-25M11-3H20"
            stroke={P.hoof}
            strokeWidth="7"
          />
          <path d="M-43-67L-57-76L-55-67L-45-61Z" fill={P.cream} />
          <path
            d="M17-82Q30-66 20-46"
            fill="none"
            stroke={P.red}
            strokeWidth="4"
          />
          <g
            transform={
              isCalf ? 'translate(34 -96) scale(1.12)' : 'translate(38 -102)'
            }
          >
            <path
              d={
                isCalf
                  ? 'M-10-19L-14-31L-12-40M-14-30L-22-34M3-20L6-34L13-40'
                  : 'M-11-19L-16-32L-15-43L-20-53M-16-33L-28-38L-31-45M-15-43L-6-48L-4-56M4-21L7-35L17-46L17-55M7-35L1-42L0-49M17-46L27-48L30-54'
              }
              fill="none"
              stroke={P.antler}
              strokeWidth={isCalf ? 2 : 3.5}
            />
            <path d="M-11-18Q-20-26-34-29Q-33-10-19-8L-11-12Z" fill={P.fur} />
            <path
              d={
                isCalf
                  ? 'M-20-4Q-21-24-3-25Q16-24 17-5Q17 17-4 18Q-22 17-20-4Z'
                  : 'M-18-4Q-20-23-2-25Q15-24 18-5Q17 14-2 16Q-18 16-18-4Z'
              }
              fill={`url(#${artworkId}-head)`}
            />
            <path
              d="M11-3Q21-4 29 1Q36 8 24 14Q9 17 7 7Z"
              fill={P.cream}
              stroke="none"
            />
            <ellipse
              cx="31"
              cy="5"
              rx="4.5"
              ry="4"
              fill={isCalf ? P.shade : P.nose}
              stroke="none"
            />
            <path
              d="M4-14L10-16L15-13M16 12Q22 16 26 10"
              fill="none"
              stroke={P.ink}
              strokeWidth={isCalf ? 1.8 : 1.4}
            />
            {isCalf ? (
              <g stroke="none">
                <ellipse cx="9" cy="-5" rx="5" ry="6" fill={P.white} />
                <ellipse cx="9" cy="-5" rx="2.7" ry="3.75" fill={P.ink} />
                <ellipse cx="8" cy="-7" rx="1" ry="1.1" fill={P.white} />
              </g>
            ) : (
              <path d="M5-5L13-4" stroke={P.ink} strokeWidth="2" />
            )}
            {isCalf && (
              <ellipse
                cx="34"
                cy="13"
                rx="9"
                ry="7"
                fill="none"
                stroke={P.gold}
                strokeWidth="3"
              />
            )}
          </g>
          {isCalf && (
            <path d="M26-94L42-91L29-80L19-58L13-61L25-87Z" fill={P.red} />
          )}
        </g>
      ))}
    </svg>
  );
};
