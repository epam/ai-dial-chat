import React, { SVGProps } from 'react';

const PromptIcon = ({
  width = 15,
  height = 15,
  ...props
}: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 18 18"
    fill="none"
    {...props}
  >
    <g clip-path="url(#clip0_3247_1198)">
      <path
        d="M4.91675 6.0835L7.83341 9.00016L4.91675 11.9168"
        stroke="#212429"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9.58325 11.9165H13.0833"
        stroke="#212429"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
    <rect
      x="1.125"
      y="1.125"
      width="15.75"
      height="15.75"
      rx="4.875"
      stroke="#212429"
      stroke-width="1.75"
      stroke-linejoin="round"
    />
    <defs>
      <clipPath id="clip0_3247_1198">
        <rect x="2" y="2" width="14" height="14" rx="4" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export { PromptIcon };
