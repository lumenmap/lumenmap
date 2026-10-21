import { embedKpis, parseEmbedQuery } from "@/lib/embed";

export default async function EmbedKpiPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; metric?: string }>;
}) {
  const query = parseEmbedQuery(await searchParams);
  const kpis = embedKpis(query.period, query.metric);

  return (
    <main
      data-testid="embed-kpi"
      className="min-h-screen bg-white p-4 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      style={{ colorScheme: "light dark" }}
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        LumenMap · {query.period} · {query.metric}
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <li key={kpi.label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">{kpi.label}</p>
            <p className="text-2xl font-semibold">{kpi.value}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
