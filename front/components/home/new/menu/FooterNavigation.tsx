"use client";

import { LogoHorizontalWhiteLogo } from "@dust-tt/sparkle";
import type { LinkProps } from "next/link";
import Link from "next/link";
import * as React from "react";

import { A, Grid } from "@app/components/home/new/ContentComponents";
import { menuConfig } from "@app/components/home/new/menu/config";
import { classNames } from "@app/lib/utils";

export function FooterNavigation() {
  return (
    <div className="z-11 mt-12 flex w-full flex-col items-center gap-6 border-b border-t border-slate-800 bg-slate-900 pb-16 pt-12">
      <div className="w-full px-12">
        <Grid gap="gap-6">
          <div className={classNames("opacity-70", "col-span-12")}>
            <LogoHorizontalWhiteLogo className="h-6 w-24" />
          </div>
          {menuConfig.footerNav.map((item, index) => (
            <div
              key={index}
              className="col-span-6 flex flex-col space-y-2 sm:col-span-4 md:col-span-2"
            >
              {item.href ? (
                <FooterLink key={item.href} href={item.href}>
                  {item.title}
                </FooterLink>
              ) : (
                item.title !== "More" && (
                  <div className="block select-none py-2 text-xs font-medium uppercase leading-none text-slate-100 no-underline outline-none">
                    {item.title}
                  </div>
                )
              )}
              {item?.items?.length &&
                item.items.map((item) => (
                  <React.Fragment key={item.href}>
                    {item.href ? (
                      <FooterLink href={item.href}>{item.title}</FooterLink>
                    ) : (
                      <div className="block select-none py-2 pt-4 text-xs font-medium uppercase leading-none text-slate-400 no-underline outline-none">
                        {item.title}
                      </div>
                    )}
                  </React.Fragment>
                ))}
            </div>
          ))}
        </Grid>
      </div>
    </div>
  );
}

interface FooterLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function FooterLink({
  href,
  onOpenChange,
  children,
  ...props
}: FooterLinkProps) {
  return (
    <Link
      href={href}
      onClick={() => {
        onOpenChange?.(false);
      }}
      shallow={true}
      {...props}
    >
      <A variant="tertiary" className="text-sm">
        {children}
      </A>
    </Link>
  );
}
