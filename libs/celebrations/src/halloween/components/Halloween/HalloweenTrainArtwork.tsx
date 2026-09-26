import { useId, type CSSProperties, type FC } from 'react';
import styles from './HalloweenTrainArtwork.module.scss';

interface SmokeOutletProps {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  size: number;
  id: string;
  delay?: number;
}

const SmokeOutlet: FC<SmokeOutletProps> = ({
  x,
  y,
  driftX,
  driftY,
  size,
  id,
  delay = 0,
}) => (
  <g transform={`translate(${x} ${y})`}>
    <g className={styles.plumeFlow}>
      {[0, 1, 2].map((puff) => (
        <g
          key={puff}
          className={styles.smoke}
          style={
            {
              '--smoke-x': `${driftX}px`,
              '--smoke-y': `${driftY}px`,
              '--smoke-size': size,
              '--smoke-turn': `${puff % 2 ? -19 : 14}deg`,
              '--smoke-delay': `${-(puff * 0.87 + delay)}s`,
            } as CSSProperties
          }
        >
          <path
            d="M-22 3C-32 0-30-12-21-14C-22-24-7-31 1-24C9-31 24-24 22-14C36-12 36 2 26 6C23 18 9 21 0 15C-11 22-25 15-22 3Z"
            fill={`url(#${id}-smoke)`}
          />
          <path
            d="M-16-8C-17-17-6-22 0-15C7-23 19-17 17-9C27-4 24 6 14 6C7 16-3 11-4 7C-16 12-25 1-16-8Z"
            fill={`url(#${id}-smoke-highlight)`}
          />
          <ellipse
            cx="-6"
            cy="-9"
            rx="13"
            ry="8"
            fill={`url(#${id}-smoke-highlight)`}
            opacity="0.55"
          />
        </g>
      ))}
    </g>
  </g>
);

const TrainWheel: FC<{ x: number }> = ({ x }) => (
  <g transform={`translate(${x} 130)`}>
    <circle r="16" fill="#111d27" stroke="#ae9e75" strokeWidth="2" />
    <g className={styles.wheel}>
      <circle r="12" fill="#203b3c" stroke="#627b70" strokeWidth="1.5" />
      <path
        d="M-11 0H11M0-11V11M-8-8L8 8M8-8L-8 8"
        stroke="#acb297"
        strokeWidth="2"
      />
      <circle r="4" fill="#d6c997" stroke="#665b47" />
      <circle cx="1" cy="-1" r="1.2" fill="#fff1c1" />
    </g>
  </g>
);

const WagonFront: FC<{ x: number; id: string }> = ({ x, id }) => (
  <>
    <path
      d={`M${x - 27} 104H${x + 65}L${x + 58} 124H${x - 21}Z`}
      fill={`url(#${id}-metal)`}
      stroke="#a69874"
      strokeWidth="2"
    />
    <path
      d={`M${x - 25} 106H${x + 63}M${x - 19} 121H${x + 57}`}
      fill="none"
      stroke="#decc91"
      strokeOpacity="0.75"
      strokeWidth="1.5"
    />
    <path
      d={`M${x - 6} 108V120M${x + 43} 108V120`}
      stroke="#b39b68"
      strokeWidth="3"
    />
    <path
      d={`M${x + 11} 113H${x + 28}M${x + 14} 117H${x + 25}`}
      stroke="#c0b68f"
      strokeOpacity="0.5"
    />
    {[x - 19, x + 57].map((rivet) => (
      <circle key={rivet} cx={rivet} cy="112" r="1.4" fill="#e5d3a1" />
    ))}
    <TrainWheel x={x - 4} />
    <TrainWheel x={x + 45} />
  </>
);

/** The last wagon has separate rear/front layers for its arriving passenger. */
const HalloweenTrainArtwork: FC<{ foreground?: boolean }> = ({
  foreground = false,
}) => {
  const id = useId();

  return (
    <svg
      className={styles.artwork}
      viewBox="0 0 640 170"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.15" y2="1">
          <stop stopColor="#7b9481" />
          <stop offset="0.22" stopColor="#3e6255" />
          <stop offset="0.56" stopColor="#294440" />
          <stop offset="1" stopColor="#121d28" />
        </linearGradient>
        <linearGradient id={`${id}-boiler`} x2="0" y2="1">
          <stop stopColor="#263936" />
          <stop offset="0.3" stopColor="#729483" />
          <stop offset="0.48" stopColor="#3b6052" />
          <stop offset="1" stopColor="#101e27" />
        </linearGradient>
        <linearGradient id={`${id}-brass`} x2="0.1" y2="1">
          <stop stopColor="#f7d99c" />
          <stop offset="0.3" stopColor="#bc9660" />
          <stop offset="0.6" stopColor="#705837" />
          <stop offset="1" stopColor="#d4bd88" />
        </linearGradient>
        <radialGradient id={`${id}-lantern`} cx="36%" cy="28%" r="78%">
          <stop stopColor="#ffc16b" />
          <stop offset="0.5" stopColor="#d66c2b" />
          <stop offset="1" stopColor="#69302c" />
        </radialGradient>
        <radialGradient id={`${id}-lamp`}>
          <stop stopColor="#fffbd3" />
          <stop offset="0.45" stopColor="#ffe59a" />
          <stop offset="1" stopColor="#bd924f" />
        </radialGradient>
        <radialGradient id={`${id}-smoke`} cx="42%" cy="43%" r="59%">
          <stop stopColor="#b6d7c9" stopOpacity="0.62" />
          <stop offset="0.43" stopColor="#b1cbbc" stopOpacity="0.35" />
          <stop offset="0.8" stopColor="#96b7b3" stopOpacity="0.12" />
          <stop offset="1" stopColor="#a9c5be" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-smoke-highlight`}>
          <stop stopColor="#d5e6d0" stopOpacity="0.4" />
          <stop offset="0.65" stopColor="#e0e9d4" stopOpacity="0.12" />
          <stop offset="1" stopColor="#d5e6d0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {foreground ? (
        <>
          <path d="M470 119H499M586 119H606" stroke="#958773" strokeWidth="4" />
          <WagonFront x={525} id={id} />
          <SmokeOutlet
            id={id}
            x={592}
            y={116}
            driftX={68}
            driftY={-29}
            size={0.48}
            delay={0.35}
          />
        </>
      ) : (
        <>
          <SmokeOutlet
            id={id}
            x={92}
            y={61}
            driftX={87}
            driftY={-104}
            size={1.25}
          />
          <SmokeOutlet
            id={id}
            x={234}
            y={109}
            driftX={52}
            driftY={-45}
            size={0.5}
            delay={0.4}
          />
          <path
            d="M29 146H611"
            stroke="#a5cfb4"
            strokeWidth="1.5"
            strokeOpacity="0.2"
          />
          <path d="M235 119H500" stroke="#877e68" strokeWidth="4" />
          <path
            d="M39 122L52 96H158V56H232V123Z"
            fill={`url(#${id}-metal)`}
            stroke="#a9b89b"
            strokeWidth="2"
          />
          <path
            d="M55 86Q99 81 156 87V114H57Q45 101 55 86Z"
            fill={`url(#${id}-boiler)`}
            stroke="#97aa8c"
            strokeWidth="1.5"
          />
          <ellipse cx="56" cy="100" rx="10" ry="15" fill="#182e31" />
          <path
            d="M80 88V61H104V87M74 60H111M155 54H238L243 58H149Z"
            fill={`url(#${id}-metal)`}
            stroke={`url(#${id}-brass)`}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M83 64H101" stroke="#111e25" strokeWidth="3" />
          <path
            d="M83 87V111M129 86V113"
            stroke={`url(#${id}-brass)`}
            strokeWidth="5"
          />
          <path
            d="M62 94H147M63 113H152"
            stroke="#c6b882"
            strokeOpacity="0.7"
          />
          <path
            d="M166 63H220V101H166Z"
            fill="#131e29"
            stroke={`url(#${id}-brass)`}
            strokeWidth="2.5"
          />
          <rect
            x="170"
            y="66"
            width="46"
            height="32"
            rx="3"
            fill="#b3eac3"
            opacity="0.68"
          />
          <path
            d="M178 98V83Q182 69 190 69Q202 69 205 84V98L198 93L191 99L184 94Z"
            fill="#edf8dd"
          />
          <path d="M184 82V87M196 82V87" stroke="#24494a" strokeWidth="3" />
          <path
            d="M183 73Q192 67 201 74M191 70V63"
            fill="none"
            stroke="#546e64"
            strokeWidth="3"
          />
          <path d="M161 103H225V115H161Z" fill="#29443f" stroke="#8c9478" />
          <path
            d="M176 108H211M187 111H201"
            stroke="#cfbb80"
            strokeOpacity="0.75"
          />
          <path
            d="M45 118L28 132H60M36 128H60M45 122L51 132"
            fill="#182d32"
            stroke="#bba16f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle
            cx="50"
            cy="99"
            r="9"
            fill={`url(#${id}-lamp)`}
            stroke="#b49460"
            strokeWidth="2.5"
          />
          <path
            d="M44 93L54 103M44 101L53 92"
            stroke="#fff7cf"
            strokeOpacity="0.5"
          />
          {[285, 405, 525].map((x) => (
            <g key={x}>
              <path
                d={`M${x - 23} 101V92Q${x + 19} 84 ${x + 61} 92V106Z`}
                fill="#162c32"
                stroke="#857f60"
                strokeWidth="1.5"
              />
              <ellipse cx={x + 19} cy="103" rx="41" ry="7" fill="#0f1c26" />
              {x !== 525 && (
                <>
                  <ellipse
                    cx={x + 19}
                    cy="85"
                    rx="35"
                    ry="30"
                    fill={`url(#${id}-lantern)`}
                    stroke="#e5a461"
                  />
                  <path
                    d={`M${x + 17} 58Q${x + 9} 43 ${x + 25} 46M${x + 2} 62Q${x - 9} 85 ${x + 2} 106M${x + 34} 62Q${x + 45} 85 ${x + 34} 106`}
                    fill="none"
                    stroke="#724332"
                    strokeWidth="3"
                  />
                  <path
                    d={`M${x + 15} 62Q${x + 7} 80 ${x + 13} 100M${x + 27} 62Q${x + 34} 80 ${x + 28} 101`}
                    fill="none"
                    stroke="#e99b4c"
                    strokeWidth="1.5"
                    strokeOpacity="0.65"
                  />
                  <path
                    d={`M${x + 1} 79L${x + 11} 83L${x} 87ZM${x + 27} 83L${x + 37} 79L${x + 38} 87ZM${x + 1} 93L${x + 12} 97L${x + 18} 94L${x + 25} 98L${x + 37} 92Q${x + 20} 115 ${x + 1} 93Z`}
                    fill="#ffdc86"
                  />
                  <WagonFront x={x} id={id} />
                </>
              )}
            </g>
          ))}
          {[78, 139, 201].map((x) => (
            <TrainWheel x={x} key={x} />
          ))}
          <path
            d="M78 131L139 126L201 131"
            fill="none"
            stroke="#bea875"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <SmokeOutlet
            id={id}
            x={62}
            y={122}
            driftX={-73}
            driftY={-22}
            size={0.65}
            delay={0.3}
          />
          <SmokeOutlet
            id={id}
            x={213}
            y={126}
            driftX={62}
            driftY={-18}
            size={0.53}
            delay={0.7}
          />
          <SmokeOutlet
            id={id}
            x={373}
            y={118}
            driftX={-39}
            driftY={-41}
            size={0.38}
            delay={0.6}
          />
        </>
      )}
    </svg>
  );
};

export default HalloweenTrainArtwork;
