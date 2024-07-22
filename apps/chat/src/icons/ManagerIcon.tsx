import { SVGProps } from 'react';

const ManagerIcon = ({
  width = 30,
  height = 30,
  color = '#7FA5D0',
  ...props
}: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 30 30"
    fill="none"
    {...props}
  >
    <path
      d="M12.2056 3.91919C11.6647 4.05501 11.1379 4.2306 10.63 4.44083C10.106 4.65814 9.59857 4.91523 9.11393 5.20695C8.87221 5.35262 8.57497 5.32663 8.36395 5.16443L6.71478 4.0058L6.68408 3.99753L6.66045 4.00934C6.40495 4.26524 4.01328 6.63762 3.99793 6.68447L4.0058 6.71478L5.18057 8.38718C5.33647 8.60922 5.33765 8.89425 5.20616 9.11314C4.91444 9.59817 4.65736 10.1052 4.44083 10.6285C4.22627 11.1466 4.04792 11.6843 3.91092 12.2367C3.84557 12.5016 3.62983 12.6902 3.37668 12.7335L1.36768 13.0843L1.33973 13.0965L1.33382 13.1252V16.8748C1.33107 16.8842 1.33461 16.8944 1.34012 16.9007C1.49169 16.9807 3.0759 17.2137 3.37708 17.2661C3.65345 17.3129 3.86092 17.5247 3.91643 17.7834C4.05226 18.3283 4.22902 18.8593 4.44083 19.3707C4.63649 19.8755 4.92704 20.4223 5.20656 20.8865C5.35222 21.1282 5.32624 21.4254 5.16404 21.6364L4.0058 23.2852L3.99793 23.3155L4.00934 23.3395C4.26524 23.595 6.63762 25.9867 6.68447 26.0021L6.71478 25.9942L8.38757 24.819C8.60962 24.6631 8.89465 24.662 9.11354 24.7934C9.59896 25.0852 10.1056 25.3419 10.6296 25.5592C11.1292 25.7769 11.7072 25.9568 12.2363 26.0883C12.5005 26.1532 12.6886 26.3682 12.7327 26.6198L13.0847 28.6323C13.1347 28.7288 16.496 28.6662 16.8748 28.6662L16.9007 28.6603L16.9153 28.6323L17.2665 26.6198C17.3149 26.3406 17.5318 26.1324 17.7944 26.0808C18.3385 25.9442 18.8652 25.769 19.3707 25.56C19.8944 25.3419 20.401 25.0852 20.8861 24.793C21.1278 24.6474 21.425 24.6734 21.636 24.8356L23.2852 25.9942L23.3155 26.0021L23.3395 25.9907C23.595 25.7348 25.9867 23.3624 26.0021 23.3155L25.9942 23.2852L24.8194 21.6128C24.6635 21.3908 24.6623 21.1057 24.7938 20.8869C25.0875 20.3983 25.3442 19.892 25.5592 19.3731C25.7737 18.853 25.9521 18.3153 26.0887 17.7633C26.154 17.4984 26.3698 17.3098 26.6229 17.2665L28.6323 16.9157C28.6634 16.9003 28.6599 16.907 28.6689 16.8748L28.6662 13.1252L28.6603 13.0965C28.3859 12.9808 27.019 12.8028 26.6233 12.7339C26.3469 12.6871 26.1399 12.4757 26.0844 12.217C25.9477 11.6717 25.7714 11.1403 25.5592 10.6285C25.3426 10.1052 25.0856 9.59817 24.7934 9.11354C24.6478 8.87181 24.6738 8.57458 24.836 8.36356L25.9942 6.71478L26.0021 6.68447L25.9907 6.66045C25.734 6.40416 23.364 4.01407 23.3159 3.99753L23.2852 4.0058L21.6124 5.18097C21.3904 5.33687 21.1053 5.33805 20.8865 5.20656C20.4014 4.91523 19.894 4.65814 19.37 4.44083C18.8527 4.22666 18.3153 4.04832 17.7637 3.91171C17.4995 3.84675 17.3114 3.63179 17.2673 3.38023L16.9153 1.36768C16.9003 1.33579 16.9082 1.34012 16.8748 1.33382H13.1252L13.0981 1.33855L13.0847 1.36768L12.7335 3.38023C12.6851 3.65935 12.4682 3.86761 12.2056 3.91919ZM8.68954 20.9987C8.97378 20.4101 9.33794 19.8672 9.76707 19.3845C10.4233 18.646 11.2367 18.0444 12.1552 17.633C12.4347 17.5086 12.7548 17.5925 12.9398 17.818C13.1965 18.096 13.5118 18.3231 13.8642 18.4798C14.202 18.6397 14.628 18.7168 15 18.7168C15.4098 18.7168 15.7945 18.6322 16.1362 18.481C16.498 18.3188 16.8212 18.083 17.0818 17.7944C17.2795 17.5759 17.5893 17.5196 17.8444 17.6338C18.7625 18.044 19.5763 18.6456 20.2325 19.3837C20.6617 19.8664 21.0258 20.4093 21.3101 20.9975L21.4416 20.8558C22.8518 19.305 23.7065 17.2472 23.7065 15.0161C23.7065 14.7228 23.6943 14.4433 23.6695 14.1815C23.6352 13.8166 23.9033 13.4918 24.2683 13.4575C24.6332 13.4233 24.958 13.6914 24.9923 14.0563C25.0245 14.3969 25.0403 14.7169 25.0403 15.0161C25.0403 17.5881 24.0537 19.9617 22.4258 21.7518C22.1392 22.0671 21.8325 22.364 21.5073 22.6411L21.4951 22.6522L21.4656 22.677C19.9546 23.9517 18.0574 24.7923 15.9622 24.9915C15.6279 25.023 15.3059 25.0395 14.9996 25.0395C12.228 25.0395 9.71746 23.9151 7.90097 22.0986C6.08449 20.2821 4.96011 17.7716 4.96011 15C4.96011 12.2284 6.08449 9.71786 7.90097 7.90137C9.71746 6.08488 12.228 4.9605 14.9996 4.9605C15.3677 4.9605 15.6665 5.25931 15.6665 5.62741C15.6665 5.99551 15.3677 6.29432 14.9996 6.29432C12.5953 6.29432 10.4182 7.2691 8.84347 8.84386C7.26871 10.4186 6.29393 12.5957 6.29393 15C6.29393 17.3251 7.20532 19.4377 8.68954 20.9987ZM20.2684 21.9317C20.0223 21.3191 19.6707 20.7573 19.2373 20.2695C18.7991 19.7766 18.2787 19.3597 17.6999 19.0432C17.3944 19.3074 17.0499 19.5274 16.6775 19.6932C16.1578 19.9227 15.5905 20.0507 15 20.0507C14.4232 20.0507 13.8685 19.9286 13.3615 19.7089C12.991 19.5593 12.6016 19.3042 12.3001 19.0432C11.7213 19.3601 11.2005 19.777 10.7623 20.2703C10.3293 20.7577 9.97808 21.3195 9.73203 21.9321C11.1942 23.0447 13.0197 23.7057 14.9996 23.7057C15.3004 23.7057 15.5795 23.6927 15.837 23.6687C17.498 23.5108 19.0172 22.8852 20.2684 21.9317ZM15 8.59584C16.1386 8.59584 17.172 9.05921 17.9208 9.80722C18.6991 10.5855 19.1345 11.6292 19.1345 12.7304C19.1345 13.8709 18.6712 14.9055 17.9231 15.6535C17.0834 16.4326 16.1626 16.8649 15 16.8649C13.8611 16.8649 12.8268 16.4011 12.078 15.6523C11.3288 14.9055 10.8655 13.8709 10.8655 12.7304C10.8655 11.5918 11.3288 10.5584 12.0768 9.80958C12.8552 9.03126 13.8988 8.59584 15 8.59584ZM16.9818 10.7485C16.4759 10.2422 15.7756 9.92966 15 9.92966C14.2244 9.92966 13.5241 10.2422 13.0193 10.7474C12.5119 11.2544 12.1993 11.9548 12.1993 12.7304C12.1993 13.504 12.5131 14.2047 13.0193 14.711C13.5241 15.2185 14.2244 15.5311 15 15.5311C15.761 15.5311 16.4496 15.2303 16.9519 14.7417C17.4984 14.1579 17.8007 13.5453 17.8007 12.7304C17.8007 11.9548 17.4881 11.2544 16.9818 10.7485ZM24.1592 10.8887C24.3131 11.2221 24.1671 11.6178 23.8336 11.7717C23.5002 11.9257 23.1045 11.7796 22.9506 11.4462L22.8927 11.3206C22.7388 10.9871 22.8848 10.5915 23.2183 10.4375C23.5517 10.2836 23.9474 10.4296 24.1013 10.7631L24.1592 10.8887ZM21.7782 7.59823C22.0514 7.84271 22.0746 8.26278 21.8301 8.536C21.5857 8.80922 21.1656 8.83244 20.8924 8.58796L20.7892 8.49584C20.516 8.25136 20.4928 7.83129 20.7372 7.55807C20.9817 7.28485 21.4018 7.26162 21.675 7.5061L21.7782 7.59823ZM18.3668 5.54237C18.7133 5.66324 18.8964 6.04236 18.7755 6.38881C18.6546 6.73526 18.2755 6.91832 17.9291 6.79746L17.7991 6.75218C17.4527 6.63132 17.2696 6.2522 17.3905 5.90575C17.5113 5.5593 17.8905 5.37624 18.2369 5.4971L18.3668 5.54237ZM10.1198 3.21173C10.5647 3.02748 11.0241 2.86685 11.4938 2.73261L11.7721 1.13855C11.8296 0.809427 12.0009 0.525183 12.2394 0.324007C12.4847 0.120076 12.7934 0 13.1252 0H16.8748C17.1984 0 17.4995 0.112595 17.7377 0.30511C17.998 0.51416 18.1704 0.809821 18.2279 1.13855L18.5062 2.73261C18.9759 2.86685 19.4353 3.02748 19.8802 3.21173C20.3333 3.39952 20.7727 3.61211 21.1955 3.84714L22.5199 2.91685C22.7947 2.72355 23.1151 2.64284 23.4254 2.66922C23.7175 2.69442 24.0021 2.81449 24.232 3.02394L26.932 5.71914C27.169 5.95929 27.3036 6.26283 27.3304 6.57502C27.3568 6.88525 27.2757 7.20572 27.0831 7.48012L26.1532 8.8041C26.3883 9.22653 26.6009 9.66549 26.7883 10.1182C26.9729 10.5643 27.1335 11.0237 27.2682 11.495L28.8614 11.7721C29.189 11.8292 29.4728 12.0005 29.676 12.2422C29.8787 12.4839 30 12.7934 30 13.1252V16.8748C29.9968 17.1999 29.885 17.5015 29.6945 17.7373L29.6784 17.7578C29.476 17.9995 29.191 18.1704 28.8614 18.2279L27.2678 18.505C27.1339 18.9759 26.9729 19.4353 26.7883 19.881C26.5989 20.3361 26.3867 20.7754 26.1529 21.1959L27.0831 22.5199C27.2757 22.7943 27.3568 23.1147 27.3304 23.425C27.3052 23.7171 27.1859 24.0017 26.9761 24.232L24.2809 26.932C24.0407 27.169 23.7372 27.3036 23.425 27.3304C23.1147 27.3568 22.7943 27.2757 22.5199 27.0831L21.1955 26.1529C20.7727 26.3879 20.3337 26.6005 19.8806 26.7883C19.4318 26.9733 18.9735 27.1335 18.5062 27.2674L18.2279 28.8614C18.1704 29.191 17.9995 29.4764 17.7578 29.6787C17.5165 29.8807 17.2074 30 16.8748 30H13.1252C12.817 30 12.5292 29.8965 12.2953 29.7185L12.2394 29.676C12.0009 29.4748 11.8296 29.1906 11.7721 28.8614L11.4938 27.2674C11.0371 27.1367 10.5895 26.9804 10.1525 26.8009C9.70683 26.6312 9.2218 26.3847 8.80449 26.1529L7.48012 27.0831C7.20572 27.2757 6.88525 27.3568 6.57502 27.3304C6.28291 27.3052 5.99827 27.1859 5.76796 26.9761L3.06803 24.2809C2.83103 24.0407 2.69639 23.7372 2.66961 23.425C2.64324 23.1147 2.72434 22.7943 2.91685 22.5199L3.84714 21.1959C3.6192 20.7857 3.41133 20.3569 3.22629 19.9137C3.03181 19.477 2.86292 18.9652 2.73221 18.505L1.13855 18.2279C0.809034 18.1704 0.524002 17.9995 0.321645 17.7578C0.12165 17.5184 0.00314951 17.209 0.00275582 16.8748L0 13.1252C0 12.7934 0.121257 12.4839 0.324007 12.2422C0.527151 12.0005 0.811002 11.8292 1.13855 11.7721L2.73182 11.495C2.86646 11.0237 3.02709 10.5643 3.21173 10.1182C3.39912 9.66549 3.61172 9.22653 3.84675 8.8041L2.91685 7.48012C2.72434 7.20572 2.64324 6.88525 2.66961 6.57502C2.69481 6.28291 2.8141 5.99827 3.02394 5.76796L5.71914 3.06803C5.9589 2.83142 6.26243 2.69599 6.57463 2.66922C6.88486 2.64284 7.20532 2.72355 7.48012 2.91685L8.80449 3.84714C9.22732 3.61211 9.66667 3.39952 10.1198 3.21173Z"
      fill={color}
    />
  </svg>
);
export { ManagerIcon };
