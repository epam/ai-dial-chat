import { SVGProps } from 'react';

const WebRagIcon = ({
  width = 25,
  height = 25,
  ...props
}: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 25 25"
    fill="none"
    {...props}
  >
    <rect width="25" height="25" rx="12.5" fill="#445267" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 12.5C4 11.0203 4.37824 9.62914 5.04408 8.41712C5.23107 8.07783 5.43933 7.7527 5.66883 7.44387C7.21795 5.35492 9.70203 4 12.5 4C15.298 4 17.782 5.35504 19.3312 7.44387C19.5607 7.7527 19.7689 8.07783 19.9559 8.41712C20.6218 9.62907 21 11.0201 21 12.5C21 13.9799 20.6218 15.3709 19.9559 16.5829C19.7689 16.9222 19.5607 17.2473 19.3312 17.5561C17.782 19.6451 15.298 21 12.5 21C9.70203 21 7.21795 19.645 5.66883 17.5561C5.43933 17.2473 5.23107 16.9222 5.04408 16.5829C4.37824 15.3709 4 13.9799 4 12.5ZM6.13701 8.78758C5.58877 9.72471 5.24168 10.7929 5.15455 11.9333H8.54185C8.56876 11.0373 8.6573 10.1809 8.79827 9.38543C7.85478 9.2381 6.96226 9.0362 6.13701 8.78758ZM10.1985 5.5002C8.8633 5.93937 7.69665 6.7504 6.82045 7.80929C7.51532 8.00196 8.25766 8.15991 9.03761 8.2782C9.28624 7.31345 9.61702 6.47408 10.0031 5.81171C10.0668 5.70405 10.1319 5.59937 10.1985 5.5002ZM18.1793 7.80929C17.3031 6.75034 16.1364 5.93939 14.8013 5.5002C14.8679 5.59937 14.933 5.7042 14.9968 5.81188C15.3828 6.47416 15.7136 7.31353 15.9622 8.27836C16.7421 8.16007 17.4844 8.00196 18.1793 7.80929ZM19.8453 11.9332C19.7582 10.7927 19.4111 9.72452 18.8629 8.7874C18.0377 9.03602 17.1452 9.2379 16.2016 9.38523C16.3426 10.1807 16.4311 11.0371 16.458 11.9331L19.8453 11.9332ZM18.8629 16.2122C19.4111 15.2751 19.7582 14.2069 19.8453 13.0665H16.458C16.4311 13.9625 16.3426 14.8189 16.2016 15.6144C17.1451 15.7617 18.0376 15.9636 18.8629 16.2122ZM14.8014 19.4996C16.1366 19.0604 17.3032 18.2494 18.1794 17.1905C17.4846 16.9979 16.7422 16.8399 15.9623 16.7216C15.7136 17.6864 15.3828 18.5257 14.9968 19.1881C14.9331 19.2958 14.8679 19.4004 14.8014 19.4996ZM6.82054 17.1905C7.69674 18.2495 8.86344 19.0604 10.1986 19.4996C10.132 19.4005 10.0668 19.2956 10.0031 19.1879C9.61706 18.5257 9.28627 17.6863 9.03765 16.7215C8.25777 16.8397 7.5155 16.9979 6.82054 17.1905ZM5.15455 13.0667C5.24167 14.2071 5.58875 15.2753 6.13701 16.2124C6.96222 15.9638 7.85472 15.7619 8.79825 15.6146C8.65729 14.8191 8.56876 13.9628 8.54183 13.0667L5.15455 13.0667ZM12.5 19.8666C13.0851 19.8666 13.5802 19.3659 14.0179 18.6157C14.3417 18.0618 14.6179 17.3712 14.8318 16.5799C14.0796 16.5055 13.2997 16.4666 12.5001 16.4666C11.7004 16.4666 10.9205 16.5055 10.1683 16.5799C10.3822 17.3711 10.6585 18.0617 10.9822 18.6157C11.4199 19.3659 11.9149 19.8666 12.5 19.8666ZM12.5 5.13336C11.9149 5.13336 11.4198 5.63415 10.982 6.38427C10.6583 6.93819 10.3821 7.62881 10.1681 8.42009C10.9204 8.49447 11.7003 8.53342 12.4999 8.53342C13.2996 8.53342 14.0795 8.49447 14.8317 8.42009C14.6178 7.62888 14.3415 6.93826 14.0178 6.38427C13.58 5.63415 13.0851 5.13336 12.5 5.13336ZM9.92016 9.53213C9.78557 10.2794 9.702 11.0876 9.67507 11.9333H15.3247C15.2978 11.0876 15.2142 10.2794 15.0796 9.53213C14.2494 9.61996 13.3852 9.66671 12.4998 9.66671C11.6143 9.66671 10.7502 9.61996 9.91994 9.53213H9.92016ZM15.0796 15.4679C15.2142 14.7206 15.2978 13.9124 15.3247 13.0667H9.6751C9.70202 13.9124 9.78561 14.7206 9.92019 15.4679C10.7504 15.38 11.6145 15.3333 12.5 15.3333C13.3855 15.3333 14.2496 15.38 15.0798 15.4679H15.0796Z"
      fill="white"
    />
  </svg>
);
export { WebRagIcon };
