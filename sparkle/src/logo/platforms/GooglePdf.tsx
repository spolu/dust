import type { SVGProps } from "react";
import * as React from "react";
const SvgGooglePdf = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="#FECACA" d="m14 2 6 6h-6z" />
    <path
      fill="#F87171"
      d="M4 4a2 2 0 0 1 2-2h8v4a2 2 0 0 0 2 2h4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
    />
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M8 18H7v-5h1.5a1.5 1.5 0 0 1 0 3H8zm0-3h.5a.5.5 0 0 0 0-1H8z"
      clipRule="evenodd"
    />
    <path
      fill="#fff"
      d="M15 18h1v-2h1v-1h-1v-.5a.5.5 0 0 1 .5-.5h.5v-1h-.5a1.5 1.5 0 0 0-1.5 1.5z"
    />
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M11 18v-5h1.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5zm1.5-1a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5H12v3z"
      clipRule="evenodd"
    />
  </svg>
);
export default SvgGooglePdf;
