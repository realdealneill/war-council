// Plain <a> links, not client-side routing — main.tsx picks between App and
// an admin page by a full pathname check, so navigating between them is a
// real page load either way.
const LINKS = [
  { href: "/", label: "App" },
  { href: "/admin/dragon-stats", label: "Dragon Stats" },
  { href: "/admin/synergy-rules", label: "Synergy Rules" },
  { href: "/admin/habit-builder", label: "Habit Builder" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mb-4 flex gap-1 border-b border-neutral-800 pb-2 text-sm">
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className={`rounded px-3 py-1 ${
            current === l.href
              ? "bg-violet-950/40 text-violet-200"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          }`}
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}
