"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/#articles", label: "Articles" },
  { href: "/archive", label: "Archive" },
  { href: "/categories", label: "Categories" },
  { href: "/translations", label: "Translations" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link href="/" className="site-mark" aria-label="Home">
        VL
      </Link>
      <nav aria-label="Primary navigation">
        <ol className="site-nav">
          {navItems.map((item, index) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : item.href !== "/#articles" && pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
