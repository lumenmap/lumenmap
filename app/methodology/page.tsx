import Link from "next/link";
import {
  METHODOLOGY_SECTIONS,
  METHODOLOGY_VERSION,
} from "@/lib/metrics/methodology";
import { FLOW_METHODOLOGY_ANCHORS } from "@/lib/metrics/flow-methodology-anchors";

const FLOW_SUBSECTIONS = [
  { id: FLOW_METHODOLOGY_ANCHORS.nodes, title: "Nodes" },
  { id: FLOW_METHODOLOGY_ANCHORS.edges, title: "Edges" },
  { id: FLOW_METHODOLOGY_ANCHORS.sampling, title: "Sampling and coverage" },
  { id: FLOW_METHODOLOGY_ANCHORS.assetModes, title: "Asset modes" },
] as const;

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
          <li>
            <a
              href={`#${FLOW_METHODOLOGY_ANCHORS.flow}`}
              className="text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
            >
              Payment-flow graph
            </a>
            <ul className="mt-2 flex flex-col gap-1 pl-4">
              {FLOW_SUBSECTIONS.map((sub) => (
                <li key={sub.id}>
                  <a
                    href={`#${sub.id}`}
                    className="text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
                  >
                    {sub.title}
                  </a>
                </li>
              ))}
            </ul>
          </li>
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

        <section
          id={FLOW_METHODOLOGY_ANCHORS.flow}
          className="scroll-mt-24 space-y-5 rounded-xl border border-white/10 bg-black/20 p-5"
        >
          <h2 className="text-xl font-semibold text-white">Payment-flow graph</h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            The Flow view draws value movement between Stellar accounts in the
            selected period as a directed graph. It is a descriptive sample of
            payment edges from Hubble, not a complete ledger of transfers and
            not a measure of network health. The graph uses the same period,
            inclusive time predicate, partial-period, and Hubble freshness
            conventions as every other LumenMap metric.
            The dashboard period and account search context are shared with
            Flow; the treemap metric does not change the graph.
          </p>

          <div id={FLOW_METHODOLOGY_ANCHORS.nodes} className="scroll-mt-24 space-y-2">
            <h3 className="text-base font-semibold text-white">Nodes</h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-300">
              <li>
                A node is one Stellar account ID that is the source or
                destination of at least one edge in the rendered sample. Each
                account appears once, however many edges touch it.
              </li>
              <li>
                Labels come from entity directory data and fall back to a
                shortened account ID. A label or category (exchange, protocol,
                …) changes the display name only, never the node identity.
              </li>
              <li>
                Node metrics are in/out operation counts, in/out degree
                (distinct counterparties), and in/out volume per asset. Node
                size and degree describe the sample only; they are not
                network-wide totals for that account.
              </li>
            </ul>
          </div>

          <div id={FLOW_METHODOLOGY_ANCHORS.edges} className="scroll-mt-24 space-y-2">
            <h3 className="text-base font-semibold text-white">Edges</h3>
            <p className="text-sm text-zinc-300">
              One successful row in{" "}
              <code className="font-mono text-xs">enriched_history_operations</code>{" "}
              yields one directed transfer from{" "}
              <code className="font-mono text-xs">op_source_account</code> to
              the destination below. Use the flattened columns, filter{" "}
              <code className="font-mono text-xs">successful = TRUE</code>, and
              apply the selected <code className="font-mono text-xs">closed_at</code>{" "}
              bounds.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-xs text-zinc-300">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500">
                    <th className="py-2 pr-3">Operation type</th>
                    <th className="py-2 pr-3">Destination</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2">Asset</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr><td className="py-2 pr-3">payment</td><td className="pr-3">to</td><td className="pr-3">amount</td><td>asset_type/code/issuer</td></tr>
                  <tr><td className="py-2 pr-3">path_payment_strict_receive</td><td className="pr-3">to</td><td className="pr-3">amount received</td><td>asset_type/code/issuer</td></tr>
                  <tr><td className="py-2 pr-3">path_payment_strict_send</td><td className="pr-3">to</td><td className="pr-3">amount received</td><td>asset_type/code/issuer</td></tr>
                  <tr><td className="py-2 pr-3">create_account</td><td className="pr-3">account</td><td className="pr-3">starting_balance</td><td>native XLM</td></tr>
                  <tr><td className="py-2 pr-3">account_merge</td><td className="pr-3">into</td><td className="pr-3">excluded</td><td>no amount field</td></tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-300">
              <li>
                Path payments use the received asset and amount. The source
                amount and asset describe the exchange input; path hops never
                become separate edges. Account creation is a native XLM funding
                edge. Account merge has no transferred amount in this table,
                so it is excluded from the amount-bearing graph.
              </li>
              <li>
                Operations between the same source and destination in the same
                asset are collapsed into one edge. Sum their amounts and count
                their operations; keep different assets separate.
              </li>
              <li>
                Failed transactions, self-payments, missing account IDs,
                missing or non-positive amounts, and all other operation types
                (DEX offers, liquidity-pool flows, fees, …) are not edges.
              </li>
              <li>
                Edge amounts are not the Payment volume metric: that metric
                counts direct <code className="font-mono text-xs">payment</code>{" "}
                operations only, while the graph also shows path payments,
                funding, and drains.
              </li>
            </ul>
          </div>

          <div id={FLOW_METHODOLOGY_ANCHORS.sampling} className="scroll-mt-24 space-y-2">
            <h3 className="text-base font-semibold text-white">
              Sampling and coverage
            </h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-300">
              <li>
                Aggregate all qualifying rows before the top-N cap. Sort by
                operation count descending, normalized asset identity
                ascending, then amount descending and source/destination IDs
                ascending. Amount only breaks ties within one asset. Edges
                below the cut and nodes only they touched are omitted.
              </li>
              <li>
                Coverage reports the period, asset filter, cap N, returned
                versus total edges and qualifying operations, and a sampled
                flag. Totals use the same filters before the cap. Read absences
                as “not in the sample”, not “no activity”.
              </li>
              <li>
                Hubble freshness applies: recent ledgers can be missing, and a
                range containing the current day is partial and provisional.
              </li>
            </ul>
          </div>

          <div id={FLOW_METHODOLOGY_ANCHORS.assetModes} className="scroll-mt-24 space-y-2">
            <h3 className="text-base font-semibold text-white">Asset modes</h3>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-300">
              <li>
                Every edge has one asset identity. Native XLM is one explicit
                bucket; issued assets use asset type, code, and issuer together.
                Asset modes filter to one exact identity before sampling.
              </li>
              <li>
                Amounts in different assets are never summed. Edge thickness
                and node volume are comparable only within one asset mode, and
                an issued asset code is only meaningful together with its
                issuer.
              </li>
              <li>
                Amounts are in the asset&apos;s own units; the graph applies no
                price or fiat conversion.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
