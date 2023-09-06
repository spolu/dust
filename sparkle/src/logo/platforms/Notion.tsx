import type { SVGProps } from "react";
import * as React from "react";
const SvgNotion = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="#fff"
      d="m3.203 2.863 11.067-.818c1.36-.116 1.709-.038 2.563.584l3.533 2.488c.583.428.777.545.777 1.01v13.65c0 .855-.311 1.36-1.398 1.438l-12.852.778c-.816.039-1.204-.078-1.632-.622L2.66 17.988c-.467-.623-.66-1.089-.66-1.633V4.223c0-.7.31-1.283 1.203-1.36Z"
    />
    <path
      fill="#000"
      fillRule="evenodd"
      d="m14.27 2.045-11.067.818C2.311 2.94 2 3.523 2 4.223v12.132c0 .544.193 1.01.66 1.633l2.601 3.383c.428.544.816.661 1.632.622l12.852-.778c1.086-.077 1.398-.583 1.398-1.438V6.128c0-.442-.175-.57-.689-.947l-3.62-2.552c-.855-.622-1.205-.7-2.564-.584Zm-7.086 3.86c-1.05.07-1.287.086-1.883-.398L3.785 4.3c-.154-.156-.076-.35.312-.389l10.638-.777c.894-.078 1.359.233 1.708.505l1.825 1.322c.078.04.272.272.039.272L7.32 5.895l-.136.01ZM5.961 19.66V8.073c0-.506.155-.739.62-.778L19.2 6.556c.428-.039.621.233.621.739v11.509c0 .506-.078.934-.776.973l-12.076.7c-.698.038-1.008-.194-1.008-.817ZM17.88 8.695c.077.35 0 .7-.35.74l-.582.115v8.555c-.506.272-.971.427-1.36.427-.621 0-.776-.195-1.242-.777l-3.806-5.988v5.793l1.204.273s0 .7-.971.7l-2.678.155c-.078-.156 0-.545.271-.622l.7-.194v-7.66l-.971-.079c-.078-.35.116-.855.66-.894l2.873-.194 3.96 6.066V9.745l-1.009-.116c-.078-.429.233-.74.62-.778l2.68-.156Z"
      clipRule="evenodd"
    />
  </svg>
);
export default SvgNotion;
