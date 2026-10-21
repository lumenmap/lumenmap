import { parseEmbedQuery } from "@/lib/embed";

const TILES = [
  { name: "Payments", share: "38%" },
  { name: "Soroban", share: "27%" },
  { name: "DEX", share: "18%" },
  { name: "Trustlines", share: "11%" },
  { name: "Other", share: "6%" },
];

export default async function EmbedTreemapPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; metric?: string }>;
}) {
  const query = parseEmbedQuery(await searchParams);

  return (
    <main
      data-testid="embed-treemap"
      className="min-h-screen bg-white p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      style={{ colorScheme: "light dark" }}
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Read-only treemap · {query.period} · {query.metric}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TILES.map((tile) => (
          <li
            key={tile.name}
            className="flex min-h-16 items-end justify-between rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900"
          >
            <span>{tile.name}</span>
            <span className="text-zinc-500">{tile.share}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
