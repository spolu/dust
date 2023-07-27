import type { SVGProps } from "react";
import * as React from "react";
const SvgBeakerPlus = (props: SVGProps<SVGSVGElement>) => (
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
      d="M11.72 22c-4.67 0-7.36-.16-9.16-1.02-.78-.37-1.31-1.03-1.49-1.85-.21-.92.06-1.94.71-2.74l5.95-7.35c.32-.4.5-.9.5-1.42V3.69c-.24.03-.37.05-.38.05a.747.747 0 0 1-.86-.62c-.07-.41.21-.79.62-.86C7.67 2.25 9.2 2 11.73 2c2.53 0 4.06.25 4.12.26.41.07.68.45.62.86a.76.76 0 0 1-.86.62s-.13-.02-.38-.05v3.93c0 .51.18 1.02.5 1.42l1.6 1.98s.02.02.03.04l4.32 5.34c.65.8.91 1.83.71 2.74-.18.82-.71 1.47-1.49 1.85-1.8.86-4.5 1.02-9.16 1.02l-.02-.01ZM8.26 10.75l-5.32 6.58c-.36.45-.52 1-.41 1.47.08.37.32.65.68.83 1.53.74 4.17.87 8.51.87s6.98-.14 8.51-.87c.36-.17.6-.46.68-.83.11-.47-.05-1.02-.41-1.47l-4.11-5.08c-2.49-.04-3.67-.46-4.71-.83-.92-.33-1.73-.62-3.43-.66l.01-.01Zm1.06-1.44c1.3.12 2.1.41 2.88.69.8.29 1.56.56 2.93.68l-.57-.71c-.54-.67-.83-1.5-.83-2.36V3.56c-1.12-.07-2.88-.07-4 0v4.06c0 .59-.14 1.17-.4 1.69h-.01Zm2.4 9.94c-.41 0-.75-.34-.75-.75v-1.75H9.22c-.41 0-.75-.34-.75-.75s.34-.75.75-.75h1.75V13.5c0-.41.34-.75.75-.75s.75.34.75.75v1.75h1.75c.41 0 .75.34.75.75s-.34.75-.75.75h-1.75v1.75c0 .41-.34.75-.75.75Z"
    />
  </svg>
);
export default SvgBeakerPlus;
