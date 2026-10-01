import type { FC } from 'react';
import { ELF_RIG } from '../../utils/gift-wrapping-rig';

/** Golden ribbon with broad folded loops that remain readable at scene size. */
export const GiftBow: FC = () => (
  <g stroke="#825221" strokeWidth="1.5" strokeLinejoin="round">
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

/** Wooden reel that rotates inside the helper's grip. */
const RibbonReel: FC = () => (
  <g stroke="#493649" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M-8-7H8V7H-8Z" fill="#efbd63" />
    <path d="M-3-6V6M3-6V6" stroke="#fff0ba" fill="none" />
    <ellipse cx="-9" cy="0" rx="3" ry="10" fill="#b97957" />
    <ellipse cx="9" cy="0" rx="3" ry="10" fill="#e5b982" />
  </g>
);

interface GiftElfProps {
  /** Draw the springy coral helper. Defaults to `false`. */
  helper?: boolean;
  /** Show the master's bound, annoyed pose. Defaults to `false`. */
  stationary?: boolean;
}

/** Mischievous cartoon elves with short sleeves and independently posed expressions. */
export const GiftElf: FC<GiftElfProps> = ({
  helper = false,
  stationary = false,
}) => {
  const coat = helper ? '#ec776c' : '#3fae88';
  const shade = helper ? '#c74f61' : '#258270';
  const boots = helper ? '#944760' : '#315863';
  const expressionOpacity = stationary && !helper ? 0 : 1;
  return (
    <g
      data-elf-art
      stroke="#3f3348"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse
        cx="0"
        cy="2"
        rx={helper ? 20 : 26}
        ry="2"
        fill="#172d30"
        stroke="none"
        opacity="0.2"
      />
      {[0, 1].map((leg) => (
        <g
          key={leg}
          data-elf-leg={leg}
          style={{
            transformOrigin: `${leg ? 10 : -10}px ${ELF_RIG.legPivotY}px`,
          }}
        >
          <path
            d={leg ? 'M5-26L7-6H17L18-26Z' : 'M-18-26L-17-6H-7L-5-26Z'}
            fill="#fff1d8"
          />
          <path
            d={leg ? 'M7-17H16M8-10H16' : 'M-16-17H-7M-16-10H-8'}
            stroke={shade}
            strokeWidth="3"
            fill="none"
          />
          <path
            d={
              leg
                ? 'M5-8Q12-11 18-5Q25-1 27-7Q31 3 18 3H3Z'
                : 'M-19-8Q-12-11-6-5Q1-1 3-7Q8 3-6 3H-23Z'
            }
            fill={boots}
          />
        </g>
      ))}
      <path d="M-17-57Q-29-55-29-37L-18-32-11-48Z" fill={shade} />
      <ellipse
        cx={ELF_RIG.reel.x}
        cy={ELF_RIG.reel.y}
        rx="7"
        ry="8"
        fill="#fff1d8"
      />
      <path
        d={
          helper
            ? 'M-15-62Q-1-68 15-60L22-25Q5-15-20-25L-22-40Z'
            : 'M-18-60Q-2-70 18-60Q29-45 26-23Q1-12-27-24Q-30-46-18-60Z'
        }
        fill={coat}
      />
      <path
        d={
          helper
            ? 'M10-54Q17-37 8-23L21-26Q20-43 10-54Z'
            : 'M15-54Q23-31 5-23L24-26Q27-43 15-54Z'
        }
        fill={shade}
        stroke="none"
      />
      <path
        d={
          helper
            ? 'M-21-34Q0-28 20-34L21-27Q0-21-21-28Z'
            : 'M-27-33Q0-26 27-33L26-26Q0-18-27-26Z'
        }
        fill="#584454"
      />
      <rect
        x="-4"
        y="-33"
        width="11"
        height="10"
        rx="2"
        fill="#ffdb7d"
        stroke="none"
      />
      <path
        d="M-15-61L-8-51 0-58 8-51 16-61Q0-56-15-61Z"
        fill="#fff1d8"
        stroke="none"
      />
      <circle cx="1" cy="-43" r="2.5" fill="#ffdb7d" stroke="none" />
      {helper && (
        <g transform={`translate(${ELF_RIG.reel.x} ${ELF_RIG.reel.y})`}>
          <g data-elf-reel>
            <RibbonReel />
          </g>
          <path
            d="M-5-1Q-6-7-2-7Q1-7 1-3L5-3Q7 3 2 5Q-5 6-5-1Z"
            fill="#fff1d8"
          />
        </g>
      )}
      <g transform={`translate(${ELF_RIG.shoulder.x} ${ELF_RIG.shoulder.y})`}>
        <g
          data-elf-upper-arm
          transform={stationary ? `rotate(${helper ? 70 : 60})` : undefined}
        >
          {/* Open sleeve outlines leave no transverse elbow seam. */}
          <path
            d="M-5-6Q4-10 18-6Q24 0 18 6Q4 10-5 6Z"
            fill={coat}
            stroke="none"
          />
          <path d="M-5-6Q4-10 18-6M-5 6Q4 10 18 6" fill="none" />
          <g transform={`translate(${ELF_RIG.upperArmLength} 0)`}>
            <g
              data-elf-forearm
              transform={
                stationary ? `rotate(${helper ? 30 : 100})` : undefined
              }
            >
              <path
                d="M-6-5Q3-8 14-5L14 5Q3 8-6 5Q-9 0-6-5Z"
                fill={coat}
                stroke="none"
              />
              <path d="M-3-5Q5-7 14-5M-3 5Q5 7 14 5" fill="none" />
              <path
                d="M13-5Q14-11 18-9L20-5Q26-6 26 0Q27 7 20 7L13 4Z"
                fill="#fff1d8"
              />
              <path
                d="M12-5L13 5"
                stroke="#fff1d8"
                strokeWidth="4"
                fill="none"
              />
            </g>
          </g>
        </g>
      </g>
      <g
        data-elf-head
        style={{ transformOrigin: `${ELF_RIG.head.x}px ${ELF_RIG.head.y}px` }}
      >
        <path
          d="M-18-87L-29-93Q-30-79-19-76M18-87L29-92Q30-79 19-75"
          fill="#f2b893"
        />
        <path
          d="M-25-86L-20-81M25-85L20-80"
          fill="none"
          stroke="#c67d79"
          strokeWidth="2"
        />
        <path
          d={
            helper
              ? 'M-20-94Q-26-86-21-73L-14-79 16-74Q25-84 18-96Z'
              : 'M-23-93Q-28-81-22-69L-15-76 18-71Q26-82 20-95Z'
          }
          fill={helper ? '#824a3d' : '#e8ddd1'}
          stroke="none"
        />
        <path
          d={
            helper
              ? 'M-18-93Q-2-104 18-94L21-79Q19-58 1-58Q-17-58-20-76Z'
              : 'M-21-93Q-3-103 20-94L23-80Q25-58 2-57Q-22-57-24-78Z'
          }
          fill="#ffd4ad"
        />
        <g data-elf-expression opacity={expressionOpacity}>
          <path
            d={
              helper
                ? 'M-15-82Q-12-91-7-86Q-3-80-8-76Q-14-74-15-82ZM5-85Q11-92 16-85Q18-77 11-77Q5-77 5-85Z'
                : 'M-16-81Q-10-85-4-80Q-7-73-13-75ZM5-82Q11-86 17-81Q15-74 9-76Z'
            }
            fill="#fff9e9"
            strokeWidth="1.2"
          />
          <path
            d={helper ? 'M-8-83V-79M12-84V-80' : 'M-7-80V-77M13-81V-78'}
            fill="none"
            strokeWidth="3"
          />
          <path
            d={
              helper
                ? 'M-17-91Q-12-97-5-91M5-93Q13-98 19-90'
                : 'M-18-88Q-12-93-5-87M5-88L18-85'
            }
            fill="none"
            strokeWidth="2.8"
          />
          {helper ? (
            <>
              <path
                d="M-10-70Q2-64 14-71Q13-58 2-60Q-5-60-10-70Z"
                fill="#694155"
                stroke="none"
              />
              <path d="M-6-69L-3-65H7L10-69Z" fill="#fff9e9" stroke="none" />
            </>
          ) : (
            <path
              d="M-9-67Q0-61 11-70M9-70L13-71"
              fill="none"
              strokeWidth="2"
            />
          )}
        </g>
        <g data-elf-surprise opacity="0">
          <path
            d="M-16-81Q-16-90-10-90Q-4-90-4-81Q-4-75-10-75Q-16-75-16-81ZM5-81Q5-90 11-90Q17-90 17-81Q17-75 11-75Q5-75 5-81Z"
            fill="#fff9e9"
            strokeWidth="1.2"
          />
          <path d="M-9-84V-80M12-84V-80" fill="none" strokeWidth="2.8" />
          <path
            d="M-17-94Q-11-99-4-94M5-95Q12-99 18-94"
            fill="none"
            strokeWidth="2.8"
          />
          <ellipse cx="2" cy="-65" rx="4" ry="5" fill="#694155" stroke="none" />
        </g>
        {!helper && (
          <g data-elf-annoyed opacity={stationary ? 1 : 0}>
            <path
              d="M-16-80L-4-77Q-9-72-14-75ZM5-77L17-81Q17-73 10-74Z"
              fill="#fff9e9"
              strokeWidth="1.2"
            />
            <path d="M-7-78V-76M12-78V-76" fill="none" strokeWidth="2.8" />
            <path d="M-18-87L-4-82M5-82L19-88" fill="none" strokeWidth="3" />
            <path
              d="M-8-65Q0-69 10-65M10-65L12-66"
              fill="none"
              strokeWidth="2"
            />
          </g>
        )}
        <path
          d="M-18-72L-13-71M15-72L19-74"
          fill="none"
          stroke="#e99d8e"
          strokeWidth="3.5"
        />
        <path
          d="M-1-76Q3-81 7-76Q10-70 4-70Q-2-70-1-76Z"
          fill="#efb18e"
          strokeWidth="1.2"
        />
        <g
          data-elf-cap
          style={{ transformOrigin: `${ELF_RIG.cap.x}px ${ELF_RIG.cap.y}px` }}
        >
          <path
            d={
              helper
                ? 'M-21-97L-13-120Q-6-132 6-124Q15-127 27-119Q33-115 29-110Q22-116 14-112L21-96Z'
                : 'M-23-96Q-24-115-9-125Q-2-131 8-123Q13-121 19-119Q26-119 27-113Q12-117 10-104L23-96Z'
            }
            fill={coat}
          />
          <path
            d={
              helper
                ? 'M-13-111Q-2-114 9-105L15-99H-18Z'
                : 'M-16-111Q-4-118 7-109L14-100H-21Z'
            }
            fill={shade}
            stroke="none"
          />
          <circle
            cx={helper ? 29 : 27}
            cy={helper ? -110 : -113}
            r="5"
            fill="#ffdd89"
          />
          <path d="M-23-100Q-3-106 22-99L23-91Q-1-97-23-91Z" fill="#fff1d8" />
        </g>
      </g>
      {stationary && !helper && (
        <g data-elf-wrapped fill="none" strokeLinecap="round">
          <path
            d="M-24-52Q0-41 24-49M-26-37Q0-27 26-35M-23-23Q0-14 23-22M-16-9Q0-3 16-8"
            stroke="#986330"
            strokeWidth="8"
          />
          <path
            d="M-24-52Q0-41 24-49M-26-37Q0-27 26-35M-23-23Q0-14 23-22M-16-9Q0-3 16-8"
            stroke="#f4c265"
            strokeWidth="5"
          />
          <g transform="translate(0 -45) scale(.5)">
            <GiftBow />
          </g>
        </g>
      )}
    </g>
  );
};
