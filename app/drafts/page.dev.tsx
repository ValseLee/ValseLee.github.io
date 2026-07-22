import Link from "next/link";
import { notFound } from "next/navigation";

import { isDraftPreviewEnabled, listDrafts, type DraftKind } from "@/lib/draft-preview.mjs";

const groups: { kind: DraftKind; title: string }[] = [
  { kind: "articles", title: "Articles" },
  { kind: "portfolio", title: "Portfolio" },
];

export default function DraftsPage() {
  if (!isDraftPreviewEnabled()) notFound();
  const drafts = listDrafts();

  return (
    <main className="py-12">
      <h1 className="font-serif text-4xl font-semibold mb-12">Local drafts</h1>
      {groups.map(({ kind, title }) => {
        const items = drafts.filter((draft) => draft.kind === kind);
        return (
          <section key={kind} className="mb-12">
            <h2 className="font-serif text-2xl font-medium mb-6 text-accent">{title}</h2>
            {items.length === 0 ? (
              <p className="text-subtext">No drafts.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((draft) => (
                  <li key={draft.slug}>
                    <Link href={`/drafts/${kind}/${encodeURIComponent(draft.slug)}`} className="transition-opacity hover:opacity-70">
                      {draft.label}{draft.valid ? "" : " · Invalid"} · <span className="text-subtext text-sm">{draft.slug}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
