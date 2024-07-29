import type { SVGProps } from "react";
import * as React from "react";
const SvgZapier = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 -30.5 256 256"
    {...props}
  >
    <g>
      <path
        d="M118.249172,51.2326115 L118.249172,194.005605 L0,194.005605 L118.249172,51.2326115 Z M118.249172,2.84217094e-14 C118.249172,32.6440764 91.7686624,59.124586 59.124586,59.124586 C26.4805096,59.124586 0,32.6440764 0,2.84217094e-14 L118.249172,2.84217094e-14 Z M137.750828,194.005605 C137.750828,161.328917 164.198726,134.881019 196.875414,134.881019 C229.552102,134.881019 256,161.361529 256,194.005605 L137.750828,194.005605 Z M137.750828,142.740382 L137.750828,0 L256,0 L137.750828,142.740382 Z"
        fill="#03363D"
      ></path>
    </g>
  </svg>
);
export default SvgZapier;
