"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/categories", label: "Categories" },
  { href: "/translations", label: "Translations" },
  { href: "/about", label: "About" },
  { href: "/graph", label: "Graph" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="py-8">
      <nav className="flex flex-wrap gap-4 justify-center sm:justify-start">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm tracking-wide transition-opacity duration-200 hover:opacity-70 ${
                isActive ? "text-accent" : "text-subtext"
              }`}
            >
              [ {item.label} ]
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
