import type { SVGProps } from "react";
import * as React from "react";
const SvgPaperAirplane = (props: SVGProps<SVGSVGElement>) => (
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
      d="M16 23q-2.501-5-5-10L1 9l21-7q-3.003 10.5-6 21m3.035-17.903L6.812 9.17 11 10.886 15 9l-1.753 4 2.242 4.507z"
    />
  </svg>
);
export default SvgPaperAirplane;
