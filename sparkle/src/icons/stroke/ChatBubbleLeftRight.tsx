import type { SVGProps } from "react";
import * as React from "react";
const SvgChatBubbleLeftRight = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.595 17.985c-.792.43-1.602.815-2.395 1.167-.687.306-1.362.586-2 .848v-3.23c-3.976 0-7.2-3.307-7.2-7.385C0 5.306 3.224 2 7.2 2h3.6c3.515 0 6.442 2.583 7.074 6h.526c3.093 0 5.6 2.572 5.6 5.744s-2.45 5.743-5.6 5.743V22s-.9-.346-2-.843c-.839-.379-1.793-.845-2.55-1.31-.752-.463-1.568-1.07-2.255-1.862M9.2 14.769h-2c-2.824 0-5.2-2.363-5.2-5.384S4.376 4 7.2 4h3.6c2.375 0 4.433 1.671 5.028 4H15.6c-3.093 0-5.6 2.572-5.6 5.744 0 .967.195 1.813.517 2.55a29 29 0 0 1-1.317.659zm9.2 2.718h-2v1.462c-.54-.262-1.068-.539-1.502-.806-1.543-.95-2.898-2.278-2.898-4.4C12 11.629 13.66 10 15.6 10h2.8c1.94 0 3.6 1.628 3.6 3.744 0 2.129-1.615 3.743-3.6 3.743"
      clipRule="evenodd"
    />
  </svg>
);
export default SvgChatBubbleLeftRight;
