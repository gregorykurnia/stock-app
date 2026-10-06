"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavigationLink = {
  label: string;
  href: string;
  badge?: string;
};

type NavigationSection = {
  label: string;
  href: string;
  links: NavigationLink[];
  routes: string[];
  matches?: RegExp[];
};

const sections: NavigationSection[] = [
  {
    label: "Research",
    href: "/",
    links: [
      { label: "Master Table", href: "/" },
      { label: "Screener", href: "/screener-draft", badge: "Draft" },
      { label: "Notes", href: "/notes" },
      { label: "Watchlist", href: "/watchlist" },
      { label: "Alerts", href: "/alerts" },
    ],
    routes: ["/", "/screener-draft", "/notes", "/watchlist", "/alerts"],
    matches: [/^\/stock\/[^/]+\/?$/, /^\/breakout-chart\/[^/]+\/?$/],
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    links: [
      { label: "Holdings", href: "/portfolio" },
      { label: "Performance", href: "/performance" },
      { label: "Returns", href: "/performance-returns" },
    ],
    routes: ["/portfolio", "/performance", "/performance-returns"],
  },
  {
    label: "Markets",
    href: "/markets",
    links: [
      { label: "Market Overview", href: "/markets" },
      { label: "ETF", href: "/etf" },
      { label: "Heatmap", href: "/heatmap" },
    ],
    routes: ["/markets", "/etf", "/heatmap"],
  },
  {
    label: "Personal Finance",
    href: "/personal-finance",
    links: [],
    routes: ["/personal-finance"],
  },
];

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function activeSectionFor(pathname: string) {
  return sections.find(
    (section) =>
      section.routes.includes(pathname) ||
      section.matches?.some((pattern) => pattern.test(pathname)),
  );
}

function secondaryLinkClass(isCurrent: boolean) {
  return [
    "inline-flex h-full shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600",
    isCurrent
      ? "border-indigo-600 font-semibold text-indigo-900"
      : "border-transparent font-medium text-[var(--muted)] hover:border-gray-300 hover:text-[var(--foreground)]",
  ].join(" ");
}

function PrimaryLink({
  section,
  pathname,
  onClick,
}: {
  section: NavigationSection;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = activeSectionFor(pathname) === section;
  const isCurrentPage = pathname === section.href;

  return (
    <Link
      href={section.href}
      aria-current={isActive ? (isCurrentPage ? "page" : "location") : undefined}
      onClick={onClick}
      className={[
        "inline-flex min-h-10 shrink-0 items-center rounded-md border-b-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
        isActive
          ? "border-indigo-600 font-semibold text-[var(--foreground)]"
          : "border-transparent font-medium text-[var(--muted)] hover:bg-black/[0.03] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {section.label}
    </Link>
  );
}

function SecondaryLinks({
  section,
  pathname,
  onClick,
}: {
  section: NavigationSection;
  pathname: string;
  onClick?: () => void;
}) {
  return section.links.map((link) => {
    const isCurrentPage = pathname === link.href;

    return (
      <li key={link.href} className="h-full">
        <Link
          href={link.href}
          aria-current={isCurrentPage ? "page" : undefined}
          onClick={onClick}
          className={secondaryLinkClass(isCurrentPage)}
        >
          {link.label}
          {link.badge && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-800">
              {link.badge}
            </span>
          )}
        </Link>
      </li>
    );
  });
}

export default function AppNavigation() {
  const pathname = normalizePathname(usePathname());
  const activeSection = activeSectionFor(pathname);
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = openMenuPath === pathname;
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  function closeMobileMenu() {
    setOpenMenuPath(null);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 backdrop-blur">
      <div className="relative mx-auto max-w-screen-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-bold text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Stock Analysis
          </Link>

          <nav aria-label="Primary navigation" className="hidden min-w-0 md:block">
            <ul className="flex items-center gap-1">
              {sections.map((section) => (
                <li key={section.href}>
                  <PrimaryLink section={section} pathname={pathname} />
                </li>
              ))}
            </ul>
          </nav>

          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 md:hidden"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            onClick={() =>
              setOpenMenuPath((openPath) =>
                openPath === pathname ? null : pathname,
              )
            }
          >
            <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
            Menu
          </button>
        </div>

        {activeSection && activeSection.links.length > 0 && (
          <>
            <nav
              aria-label={`${activeSection.label} pages`}
              className="hidden h-10 overflow-x-auto px-4 sm:px-6 md:block md:pl-44 lg:pl-48"
            >
              <ul className="flex h-full min-w-max items-center gap-1 md:justify-end">
                <SecondaryLinks section={activeSection} pathname={pathname} />
              </ul>
            </nav>
            <nav
              aria-label={`${activeSection.label} pages`}
              className="overflow-x-auto px-4 sm:px-6 md:hidden"
            >
              <ul className="flex h-10 min-w-max items-center gap-1">
                <SecondaryLinks section={activeSection} pathname={pathname} />
              </ul>
            </nav>
          </>
        )}

        <div
          id="mobile-navigation-menu"
          hidden={!mobileMenuOpen}
          className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-[var(--border)] bg-white px-4 py-3 shadow-lg md:hidden sm:px-6"
        >
          <nav aria-label="Mobile navigation" className="grid gap-4">
            {sections.map((section) => (
              <section key={section.href} aria-label={`${section.label} pages`}>
                <PrimaryLink
                  section={section}
                  pathname={pathname}
                  onClick={closeMobileMenu}
                />
                {section.links.length > 0 && (
                  <ul className="mt-1 grid gap-1 border-l border-gray-200 pl-3">
                    {section.links.map((link) => {
                      const isCurrentPage = pathname === link.href;

                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            aria-current={isCurrentPage ? "page" : undefined}
                            onClick={closeMobileMenu}
                            className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-[var(--muted)] hover:bg-gray-50 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                          >
                            {link.label}
                            {link.badge && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-800">
                                {link.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
