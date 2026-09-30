import { useId, type FC } from 'react';
import { ELF_RIG } from '../../utils/gift-wrapping-plan';

/** Golden ribbon with broad folded loops that remain readable at scene size. */
export const GiftBow: FC = () => (
  <g stroke="#825221" strokeWidth="1.1" strokeLinejoin="round">
    <path d="M0 0C-12-22-36-24-32-9C-29 2-10 5 0 0Z" fill="#edbc58" />
    <path d="M0 0C12-22 36-24 32-9C29 2 10 5 0 0Z" fill="#ffe29b" />
    <path
      d="M-3 1L-16 24-19 15-27 17-9-4M3 1L16 24 19 15 27 17 9-4"
      fill="#dca144"
    />
    <path
      d="M-29-12Q-15-13-5-3M29-12Q15-13 5-3"
      fill="none"
      stroke="#fff0ba"
      strokeWidth="2"
    />
    <rect x="-6" y="-7" width="12" height="13" rx="4" fill="#f7cf79" />
  </g>
);

/** Wooden reel carried by the master throughout the wrapping and return. */
const RibbonReel: FC = () => (
  <g stroke="#754a2a" strokeWidth="1.4">
    <path d="M-9-8H9V8H-9Z" fill="#ebbe67" />
    <path d="M-5-7V7M0-7V7M5-7V7" stroke="#fff0bb" />
    <ellipse cx="-10" cy="0" rx="4" ry="12" fill="#bd8451" />
    <ellipse cx="10" cy="0" rx="4" ry="12" fill="#e9bc81" />
    <circle cx="10" cy="0" r="2" fill="#754a2a" />
  </g>
);

interface ElfProps {
  /** The shorter helper wears the bow; the master carries the reel. */
  helper?: boolean;
  /** Show the final bow without starting animation. */
  stationary?: boolean;
}

/** Articulated elf whose foot origin, shoulder and cap tip match ELF_RIG. */
export const GiftElf: FC<ElfProps> = ({
  helper = false,
  stationary = false,
}) => {
  const id = useId();
  const coat = `url(#${id}-coat)`;
  return (
    <g data-elf-art>
      <defs>
        <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="1" y2="0.8">
          <stop stopColor={helper ? '#d7796d' : '#529d91'} />
          <stop offset="0.48" stopColor={helper ? '#ac444b' : '#286d66'} />
          <stop offset="1" stopColor={helper ? '#642735' : '#163e43'} />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x2="0.8" y2="1">
          <stop stopColor="#ffe0b4" />
          <stop offset="1" stopColor="#c68a69" />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="2" rx="25" ry="3" fill="#233234" opacity="0.18" />
      {[0, 1].map((leg) => (
        <g
          key={leg}
          data-elf-leg={leg}
          style={{ transformOrigin: `${leg ? 10 : -10}px -29px` }}
        >
          <path
            d={leg ? 'M6-29L8-5H18L17-30Z' : 'M-18-29L-17-5H-6L-6-28Z'}
            fill="#e2cea3"
          />
          <path
            d={leg ? 'M8-21H17M8-13H18' : 'M-17-21H-7M-17-13H-7'}
            stroke="#9c454b"
            strokeWidth="3"
          />
          <path
            d={
              leg
                ? 'M7-8Q15-10 19-5L29-8Q32 1 17 2H5Z'
                : 'M-18-8Q-10-10-5-5L3-7Q6 1-8 2H-21Z'
            }
            fill="#443438"
            stroke="#d6ad79"
            strokeWidth="1"
          />
        </g>
      ))}
      <path
        d="M-16-62Q-28-56-26-34L-18-24-9-30-7-49Z"
        fill={coat}
        stroke="#223c3b"
      />
      <path
        d="M-24-34Q-29-25-22-21Q-12-17-11-25L-15-32Z"
        fill="#edcda0"
        stroke="#976e53"
      />
      {!helper && (
        <g transform="translate(-22 -23)">
          <g data-elf-reel>
            <RibbonReel />
          </g>
        </g>
      )}
      <path
        d="M-15-67Q0-73 17-65L23-32Q7-22-23-32Z"
        fill={coat}
        stroke="#294241"
        strokeWidth="1.3"
      />
      <path
        d="M-15-61Q-13-42-17-34L-9-32-5-59Z"
        fill="#f7e4bd"
        opacity="0.18"
      />
      <path d="M-20-38Q0-32 21-38L22-32Q0-25-22-32Z" fill="#473b37" />
      <rect
        x="-4"
        y="-39"
        width="11"
        height="10"
        rx="1"
        fill="#e5b95d"
        stroke="#fff0b5"
      />
      <rect x="-1" y="-36" width="5" height="4" rx="1" fill="#554235" />
      <path d="M-15-66L-8-54 0-63 9-54 17-66" fill="#f5e7c8" />
      <circle cx="2" cy="-49" r="2" fill="#f5cc72" />
      <g data-elf-head style={{ transformOrigin: '0px -80px' }}>
        <path
          d="M-12-85L-25-92Q-27-78-13-75M13-84L25-90Q26-77 14-74"
          fill="#e9b38e"
          stroke="#ae775e"
        />
        <path
          d="M-15-92Q-23-81-15-70L-6-74 14-73Q21-85 12-94Z"
          fill={helper ? '#9c5b36' : '#e9e3d3'}
        />
        <ellipse cx="1" cy="-82" rx="16" ry="17" fill={`url(#${id}-skin)`} />
        <path
          d="M-12-93Q-5-104 12-93L10-87 5-92-3-87-6-92Z"
          fill={helper ? '#9c5b36' : '#ddd7c7'}
        />
        <path
          d="M-7-87L-2-88M8-88L13-86"
          fill="none"
          stroke="#795044"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <ellipse cx="-4" cy="-82" rx="1.7" ry="2.5" fill="#303034" />
        <ellipse cx="10" cy="-82" rx="1.7" ry="2.5" fill="#303034" />
        <path
          d="M2-82Q12-80 6-76H1"
          fill="#eab18b"
          stroke="#b57961"
          strokeWidth="0.7"
        />
        <ellipse
          cx="-8"
          cy="-76"
          rx="4"
          ry="2.5"
          fill="#d98579"
          opacity="0.6"
        />
        <path
          d="M-2-71Q3-67 8-72"
          fill="none"
          stroke="#81473e"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <g
          data-elf-cap
          style={{ transformOrigin: `0px ${ELF_RIG.capBase.y}px` }}
        >
          <path
            d="M-17-94Q-15-125 4-132Q21-137 28-124Q15-126 15-112L19-94Z"
            fill={coat}
            stroke="#34463d"
            strokeWidth="1.1"
          />
          <path
            d="M-11-100Q-12-120 4-127"
            fill="none"
            stroke="#ffe5b1"
            strokeOpacity="0.32"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx={ELF_RIG.capTip.x}
            cy={ELF_RIG.capTip.y}
            r="5"
            fill="#faeac8"
            stroke="#c4a372"
          />
          {helper && (
            <g transform={`translate(${ELF_RIG.capTip.x} ${ELF_RIG.capTip.y})`}>
              <g data-elf-bow opacity={stationary ? 1 : 0}>
                <GiftBow />
              </g>
            </g>
          )}
        </g>
        <path
          d="M-19-99Q0-104 19-99L20-91Q0-96-19-91Z"
          fill="#f2e4c5"
          stroke="#c7b996"
        />
      </g>
      <g transform={`translate(${ELF_RIG.shoulder.x} ${ELF_RIG.shoulder.y})`}>
        <g data-elf-upper-arm>
          <path
            d={`M-3-7Q14-12 ${ELF_RIG.armLength + 2}-6L${ELF_RIG.armLength + 2} 6Q12 10-3 7Z`}
            fill={coat}
            stroke="#34483e"
          />
          <g transform={`translate(${ELF_RIG.armLength} 0)`}>
            <g data-elf-forearm>
              <path
                d={`M-4-6Q10-9 ${ELF_RIG.armLength - 6}-5V5Q8 8-4 6Z`}
                fill={coat}
                stroke="#34483e"
              />
              <path
                d={`M${ELF_RIG.armLength - 8}-6V6`}
                stroke="#f2e4c5"
                strokeWidth="5"
              />
              <path
                d={`M${ELF_RIG.armLength - 5}-5Q${ELF_RIG.armLength + 8}-8 ${ELF_RIG.armLength + 6} 1Q${ELF_RIG.armLength + 5} 8 ${ELF_RIG.armLength - 4} 6L${ELF_RIG.armLength - 8} 1Z`}
                fill="#edcda0"
                stroke="#976e53"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
};
