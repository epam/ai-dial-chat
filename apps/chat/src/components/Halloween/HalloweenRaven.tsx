import { useId, type FC } from 'react';

/** The beak tip is fixed at (114, 35), shared with every grip in the scene. */
const HalloweenRaven: FC = () => {
  const id = useId();
  return (
    <svg
      viewBox="0 0 120 110"
      focusable="false"
      aria-hidden="true"
      data-raven-art="true"
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop stopColor="#858899" />
          <stop offset="0.3" stopColor="#333648" />
          <stop offset="0.7" stopColor="#171b29" />
          <stop offset="1" stopColor="#090c15" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="0.6" y2="1">
          <stop stopColor="#6c7189" />
          <stop offset="0.45" stopColor="#2b324b" />
          <stop offset="1" stopColor="#0a0f1d" />
        </linearGradient>
      </defs>
      <path
        d="M53 67L17 99L28 97L27 105L42 97L42 102L66 76Z"
        fill="#182034"
        stroke="#768099"
        strokeWidth="0.8"
      />
      <path
        d="M61 75L57 96L46 99M57 96L65 100M75 74L79 96L69 101M79 96L88 100"
        fill="none"
        stroke="#aea79c"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M49 40C34 57 38 76 52 84C72 98 88 79 85 59L78 37Z"
        fill={`url(#${id}-body)`}
        stroke="#8a91a2"
        strokeWidth="0.7"
      />
      <path
        d="M69 68L66 80M74 68L72 79M60 73L60 82"
        stroke="#b6b9c6"
        strokeOpacity="0.23"
        strokeWidth="1.1"
      />
      <g data-raven-wing="true" style={{ transformOrigin: '66px 49px' }}>
        <path
          d="M68 49C53 34 35 17 8 7L4 13L15 27L7 24L10 32L24 42L13 40L18 49L33 57L25 59L39 70L33 72L50 81L65 71L74 57Z"
          fill={`url(#${id}-wing)`}
          stroke="#939cb7"
          strokeWidth="0.85"
        />
        <path
          d="M12 15L58 56M15 30L59 61M24 45L60 66M33 58L60 70"
          fill="none"
          stroke="#a6afc5"
          strokeOpacity="0.36"
          strokeWidth="1"
        />
        <path
          d="M66 47Q43 30 27 24Q37 46 64 66Z"
          fill="#546078"
          opacity="0.35"
        />
      </g>
      <path
        d="M59 48C50 39 49 23 61 16C70 10 86 12 90 24L91 34L86 42L78 56L69 61L71 49L64 54Z"
        fill={`url(#${id}-body)`}
        stroke="#9096a8"
        strokeWidth="0.8"
      />
      <path
        d="M88 25Q103 27 114 35L89 37L85 32Z"
        fill="#4a4a4d"
        stroke="#b2afa2"
        strokeWidth="0.7"
      />
      <path d="M88 31L114 35L91 34" fill="#b5b2a4" />
      <path
        d="M59 24Q68 14 81 20"
        fill="none"
        stroke="#c1c7d7"
        strokeOpacity="0.38"
      />
      <ellipse cx="81" cy="26" rx="3.1" ry="2.7" fill="#ffcf87" />
      <circle cx="82" cy="26" r="1.65" fill="#0b0b16" />
      <circle cx="80.8" cy="24.9" r="0.8" fill="#fff6df" />
    </svg>
  );
};

export default HalloweenRaven;
