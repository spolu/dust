import * as React from "react";
import type { SVGProps } from "react";
const SvgPlanet = (props: SVGProps<SVGSVGElement>) => (
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
      d="M3.918 8.037A9 9 0 0 0 15.966 20.08c.873.373 1.719.618 2.49.681.902.074 1.844-.096 2.526-.777.752-.752.88-1.816.746-2.812-.123-.91-.48-1.92-1.002-2.962A9 9 0 0 0 9.791 3.273c-1.044-.523-2.055-.881-2.965-1.005-.997-.135-2.062-.007-2.815.746-.682.683-.851 1.626-.777 2.528.064.773.31 1.62.684 2.495Zm1.404-2.071a4.135 4.135 0 0 1-.095-.587c-.048-.587.09-.843.198-.95.12-.12.423-.275 1.132-.179.198.027.413.072.643.135a9.04 9.04 0 0 0-1.878 1.58Zm14.29 10.837a4.9 4.9 0 0 1 .134.637c.096.708-.06 1.011-.178 1.13-.109.108-.364.246-.95.199a4.116 4.116 0 0 1-.581-.094 9.04 9.04 0 0 0 1.575-1.872Zm-3.73 1.023c-1.677-.878-3.625-2.323-5.507-4.205-1.88-1.88-3.324-3.825-4.203-5.5A7.018 7.018 0 0 1 9.97 5.298a7 7 0 0 1 5.912 12.528Zm-2.277.99a7 7 0 0 1-8.42-8.419c.964 1.516 2.25 3.112 3.776 4.638 1.528 1.528 3.126 2.815 4.644 3.78Z"
    />
  </svg>
);
export default SvgPlanet;
