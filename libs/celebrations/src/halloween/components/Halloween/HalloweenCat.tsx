import { memo, useId, type FC } from 'react';

/** A seated adult cat; the near paw has two 24-unit joints for measured contact. */
const HalloweenCat: FC = () => {
  const id = useId();

  return (
    <svg viewBox="0 0 160 140" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id={`${id}-coat`}
          gradientUnits="userSpaceOnUse"
          x1="52"
          y1="61"
          x2="103"
          y2="112"
        >
          <stop stopColor="#454451" />
          <stop offset="0.24" stopColor="#2d2c38" />
          <stop offset="0.62" stopColor="#191922" />
          <stop offset="1" stopColor="#0e1018" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.35" cy="0.26" r="0.86">
          <stop stopColor="#484653" />
          <stop offset="0.46" stopColor="#262632" />
          <stop offset="1" stopColor="#10111a" />
        </radialGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#161721" />
          <stop offset="0.42" stopColor="#353440" />
          <stop offset="1" stopColor="#161721" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#45424e" />
          <stop offset="0.45" stopColor="#292833" />
          <stop offset="1" stopColor="#14151e" />
        </linearGradient>
        <radialGradient id={`${id}-iris`} cx="0.48" cy="0.4" r="0.65">
          <stop stopColor="#ffe6a0" />
          <stop offset="0.45" stopColor="#efb646" />
          <stop offset="1" stopColor="#966126" />
        </radialGradient>
      </defs>

      <g data-cat-part="tail">
        <path
          d="M62 96C46 101 26 94 22 79C18 65 28 58 29 48C30 42 28 36 25 33C22 29 19 31 20 35C23 42 21 47 17 55C9 70 12 85 23 96C32 106 49 110 63 104Z"
          fill={`url(#${id}-tail)`}
          stroke="#6a6170"
          strokeOpacity="0.42"
          strokeWidth="0.65"
        />
        <path
          d="M24 36C27 48 18 56 17 68C15 84 28 99 46 101"
          fill="none"
          stroke="#a394a7"
          strokeOpacity="0.24"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        <path
          d="M18 62L16 66M18 80L20 83M32 96L36 98"
          stroke="#817585"
          strokeOpacity="0.3"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      </g>

      <g data-cat-part="far-leg">
        <path
          d="M82 77C78 84 80 95 82 102L83 114C80 116 79 119 83 120H94C97 119 95 115 91 114L93 98L94 82Z"
          fill="#10121b"
          stroke="#625b6b"
          strokeOpacity="0.48"
          strokeWidth="0.7"
        />
        <path
          d="M86 88L87 108M86 117L86 119M91 117L91 119"
          stroke="#5f5869"
          strokeOpacity="0.65"
          strokeWidth="0.65"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M54 108C47 100 47 90 53 80C59 70 71 69 77 62L82 53L87 55L91 49L94 54L101 53C109 59 110 71 106 81C103 89 103 104 98 112C92 119 63 121 54 108Z"
        fill={`url(#${id}-coat)`}
        stroke="#79717f"
        strokeOpacity="0.6"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M54 85C61 74 74 73 81 66M56 87L54 93M87 59C87 67 84 70 83 75"
        fill="none"
        stroke="#aaa0af"
        strokeOpacity="0.24"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M97 63L100 71L96 75L99 77L95 82L96 86L92 89L94 93L90 98C85 86 87 74 91 65Z"
        fill="#67616f"
        opacity="0.26"
      />
      <path
        d="M87 67L89 72M85 71L86 76M91 76L90 81M88 82L88 87M80 96L79 101"
        fill="none"
        stroke="#9a8d9f"
        strokeOpacity="0.3"
        strokeWidth="0.65"
        strokeLinecap="round"
      />

      <g data-cat-part="hind-leg">
        <path
          d="M69 84C59 81 51 89 51 100C50 109 55 115 63 117L66 118C64 119 67 120 71 120H85C89 119 88 116 84 114L73 112C79 108 80 96 76 90C74 87 72 85 69 84Z"
          fill={`url(#${id}-coat)`}
        />
        <path
          d="M64 86C73 84 80 96 74 106L69 110M68 116L81 116M76 117L76 119M81 117L81 119"
          fill="none"
          stroke="#837887"
          strokeOpacity="0.52"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        <path
          d="M57 91C53 97 55 105 59 109"
          fill="none"
          stroke="#a599aa"
          strokeOpacity="0.18"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>

      <g data-cat-part="arm">
        <path
          d="M94 68C101 66 108 70 108 77L106 94C106 100 101 103 96 99C93 96 94 90 93 83C92 77 91 72 94 68Z"
          fill={`url(#${id}-leg)`}
        />
        <path
          d="M98 71C96 77 98 85 98 90"
          fill="none"
          stroke="#8b7f91"
          strokeOpacity="0.35"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
        <g data-cat-part="forearm">
          <path
            d="M96 91C99 89 105 90 106 94L104 110C104 112 108 114 107 117C107 119 105 120 101 120H96C93 120 92 117 94 114L94 101Z"
            fill={`url(#${id}-leg)`}
          />
          <path
            d="M97 98L97 110M96 115C98 113 103 113 105 115M98 116L98 119M102 116L102 119"
            fill="none"
            stroke="#8d8193"
            strokeOpacity="0.53"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          <circle data-cat-paw="true" cx="100" cy="120" r="0.5" opacity="0" />
        </g>
      </g>

      <g data-cat-part="head">
        <g data-cat-part="ears">
          <path
            d="M84 40C81 33 81 23 82 17C91 20 96 27 98 34L109 34C112 28 118 22 125 21C126 30 123 37 119 43Z"
            fill={`url(#${id}-face)`}
            stroke="#918294"
            strokeOpacity="0.65"
            strokeWidth="0.75"
            strokeLinejoin="round"
          />
          <path
            d="M85 22L87 36L94 33C92 28 89 25 85 22ZM121 26L112 35L118 38C120 34 121 30 121 26Z"
            fill="#895e72"
            opacity="0.78"
          />
          <path
            d="M86 26L90 33M119 29L116 35"
            stroke="#c997a4"
            strokeOpacity="0.56"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M85 34C92 29 107 30 115 35C121 39 123 45 122 50L127 52L123 56L124 59L119 61L116 65C109 70 95 67 88 63L83 63L85 59L80 57L83 54L79 50L82 47C81 41 82 37 85 34Z"
          fill={`url(#${id}-face)`}
          stroke="#938597"
          strokeOpacity="0.5"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <path
          d="M87 37L92 35M88 41L94 39M111 37L115 39M88 57L92 60M91 59L95 62"
          fill="none"
          stroke="#b7a4b7"
          strokeOpacity="0.32"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
        <path
          d="M100 36C99 42 100 46 103 49L107 51L108 45L105 35Z"
          fill="#a092a2"
          opacity="0.12"
        />
        <path
          d="M85 46Q92 39 101 45M108 44Q115 40 121 45"
          fill="none"
          stroke="#11111a"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <g data-cat-part="eyes">
          <path
            d="M85 46Q92 41 100 45Q95 52 89 49Z"
            fill={`url(#${id}-iris)`}
            stroke="#a98546"
            strokeWidth="0.45"
          />
          <path
            d="M109 45Q115 41 121 45Q117 51 112 49Z"
            fill={`url(#${id}-iris)`}
            stroke="#a98546"
            strokeWidth="0.45"
          />
          <g data-cat-part="pupils">
            <path
              d="M94 43Q96 46 94 50Q92 46 94 43ZM116 43Q118 46 116 50Q114 46 116 43Z"
              fill="#111317"
            />
            <ellipse cx="92" cy="45" rx="1.1" ry="0.8" fill="#fff2cd" />
            <ellipse cx="114.5" cy="45" rx="0.85" ry="0.65" fill="#fff2cd" />
          </g>
        </g>
        <path
          d="M101 52C105 49 110 51 112 54C116 51 121 52 122 55C123 59 118 62 113 61C108 64 102 61 100 57Z"
          fill="#716674"
          opacity="0.53"
        />
        <path
          d="M108 52Q112 50 116 53L112 56Z"
          fill="#ad7b8e"
          stroke="#34232f"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <path
          d="M112 55L112 58M112 58Q108 61 105 58M112 58Q116 61 119 58"
          fill="none"
          stroke="#17131c"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
        <path
          d="M105 62Q111 66 118 62"
          fill="none"
          stroke="#b6a0ae"
          strokeOpacity="0.46"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
        <g data-cat-part="tongue" opacity="0">
          <path
            d="M110 60Q114 59 117 61L116 66Q113 70 110 66Z"
            fill="#d093a3"
            stroke="#794654"
            strokeWidth="0.55"
          />
          <path d="M113.5 62L113.5 66" stroke="#ac647b" strokeWidth="0.55" />
        </g>
        <path
          d="M105 56L80 51M104 58L77 59M105 60L82 65M118 55L137 49M119 57L143 56M119 59L139 64"
          fill="none"
          stroke="#b3a2b4"
          strokeOpacity="0.58"
          strokeWidth="0.55"
          strokeLinecap="round"
        />
        <path
          d="M104 55L104.5 55M102 57L102.5 57M119 55L119.5 55"
          stroke="#d2bcc9"
          strokeOpacity="0.65"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

export default memo(HalloweenCat);
