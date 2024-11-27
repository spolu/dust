import { cva } from "class-variance-authority";
import React, { ReactNode } from "react";

import {
  noHrefLink,
  SparkleContext,
  SparkleContextLinkType,
} from "@sparkle/context";
import { cn } from "@sparkle/lib/utils";

const CARD_BUTTON_VARIANTS = ["primary", "secondary", "tertiary"] as const;

type CardButtonVariantType = (typeof CARD_BUTTON_VARIANTS)[number];

const variantClasses: Record<CardButtonVariantType, string> = {
  primary: "s-bg-structure-50 s-border-border-dark/0",
  secondary: "s-bg-background s-border-border-dark",
  tertiary: "s-bg-background s-border-border-dark/0",
};

const CARD_BUTTON_SIZES = ["sm", "md", "lg"] as const;

type CardButtonSizeType = (typeof CARD_BUTTON_SIZES)[number];

const sizeVariants: Record<CardButtonSizeType, string> = {
  sm: "s-p-3 s-rounded-xl",
  md: "s-p-4 s-rounded-2xl",
  lg: "s-p-5 s-rounded-3xl",
};

const cardButtonVariants = cva(
  "s-flex s-text-left s-group s-border s-overflow-hidden s-text-foreground",
  {
    variants: {
      variant: variantClasses,
      size: sizeVariants,
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface CommonProps {
  variant?: CardButtonVariantType;
  size?: CardButtonSizeType;
  className?: string;
}

interface LinkProps extends CommonProps {
  children?: ReactNode;
  href: string;
  target?: string;
  rel?: string;
  replace?: boolean;
  shallow?: boolean;
  onClick?: never;
  onMouseEnter?: never;
  onMouseLeave?: never;
}

interface ButtonProps
  extends CommonProps,
    React.ButtonHTMLAttributes<HTMLDivElement> {
  href?: never;
  target?: never;
  rel?: never;
  replace?: never;
  shallow?: never;
}

type CardButtonProps = LinkProps | ButtonProps;

export const CardButton = React.forwardRef<HTMLDivElement, CardButtonProps>(
  (
    {
      children,
      variant,
      size,
      className,
      onClick,
      onMouseEnter,
      onMouseLeave,
      href,
      target = "_blank",
      rel = "",
      replace,
      shallow,
      ...props
    },
    ref
  ) => {
    const { components } = React.useContext(SparkleContext);
    const Link: SparkleContextLinkType = href ? components.link : noHrefLink;

    const cardButtonClassNames = cn(
      cardButtonVariants({ variant, size }),
      (onClick || onMouseEnter) &&
        "s-cursor-pointer hover:s-border-primary-100 hover:s-bg-primary-100 active:s-bg-primary-200 disabled:s-text-primary-muted disabled:s-border-structure-100 disabled:s-pointer-events-none s-transition s-duration-200",
      className
    );

    if (href) {
      return (
        <Link
          href={href}
          className={cardButtonClassNames}
          replace={replace}
          shallow={shallow}
          target={target}
          rel={rel}
        >
          {children}
        </Link>
      );
    }

    return (
      <div
        ref={ref}
        className={cardButtonClassNames}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardButton.displayName = "CardButton";
