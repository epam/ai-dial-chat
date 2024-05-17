import { SVGProps } from 'react';

const ArrowLeftIcon = ({
  width = 4,
  height = 7,
  ...props
}: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 4 7"
    fill="none"
    {...props}
  >
    <path
      d="M3.15887 0.5C3.25153 0.5 3.34412 0.535214 3.41825 0.605706C3.56648 0.746688 3.56648 0.966953 3.41825 1.10794L0.907842 3.49558L3.41825 5.89203C3.56648 6.03302 3.56648 6.25328 3.41825 6.39426C3.27002 6.53525 3.03843 6.53525 2.89019 6.39426L0.11115 3.75112C0.0370338 3.68062 7.64515e-06 3.59256 7.65286e-06 3.50442C7.66133e-06 3.4075 0.0370338 3.31937 0.11115 3.25773L2.89019 0.614581C2.97355 0.535301 3.06628 0.5 3.15887 0.5Z"
      fill="white"
    />
  </svg>
);

export { ArrowLeftIcon };
