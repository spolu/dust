import type { SVGProps } from "react";
import * as React from "react";
const SvgMenu = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path fill="currentColor" d="M3 4h18v3H3zm0 6.5h18v3H3zM3 17h18v3H3z" />
  </svg>
);
export default SvgMenu;
