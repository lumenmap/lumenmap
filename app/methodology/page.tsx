import Link from "next/link";
import {
  METHODOLOGY_SECTIONS,
  METHODOLOGY_VERSION,
} from "@/lib/metrics/methodology";

export const metadata = {
  title: "Metric methodology · LumenMap",
  description:
    "Canonical definitions for LumenMap operations, transactions, volume, TVL, and related activity metrics.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Methodology v{METHODOLOGY_VERSION}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Metric methodology
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Canonical counting rules for LumenMap metrics. These definitions are
          descriptive of how the product measures activity; they are not
          marketing claims about network health or protocol performance.
        </p>
        <Link
          href="/"
          className="inline-flex text-sm text-stellar-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
        >
          ← Back to dashboard
        </Link>
      </header>

      <nav aria-label="Methodology sections" className="rounded-xl border border-white/10 bg-white/5 p-4">
        <ul className="flex flex-col gap-2 text-sm">
          {METHODOLOGY_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-8">
        {METHODOLOGY_SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-24 space-y-3 rounded-xl border border-white/10 bg-black/20 p-5"
          >
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <p className="text-sm leading-relaxed text-zinc-300">
              {section.summary}
            </p>
            <dl className="grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Unit</dt>
                <dd className="text-zinc-200">{section.unit}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Aggregation</dt>
                <dd className="text-zinc-200">{section.aggregation}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Time basis</dt>
                <dd className="text-zinc-200">{section.timeBasis}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Source</dt>
                <dd className="font-mono text-xs text-zinc-200">{section.source}</dd>
              </div>
            </dl>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <h3 className="text-zinc-500">Inclusions</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
                  {section.inclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-zinc-500">Exclusions</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">
                  {section.exclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h3 className="text-sm text-zinc-500">Known limitations</h3>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-zinc-300">
                {section.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
