import { For } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { StageId } from "../effect-curriculum/types";

interface ArchitectureViewProps {
  readonly onOpenStage: (stageId: StageId) => void;
}

const LAYERS = [
  {
    tier: "01. Foundation & Dependency Injection",
    modules: "Effect · Context.Service · Layer · Option · Config · Schema · Match",
    stageId: "stage-01" as StageId,
    devLayer: "Layer.succeed / ConfigProvider.fromEnv",
    prodLayer: "ManagedRuntime + environment ConfigProvider + Redacted secrets",
    summary:
      "Pure functional domain pipelines with compile-time tracked requirements (R), typed errors (E), and exhaustive pattern matching.",
  },
  {
    tier: "02. Streaming & HTTP Edge",
    modules: "Stream · HttpApi · HttpApiBuilder · HttpRouter · HttpServer",
    stageId: "stage-06" as StageId,
    devLayer: "HttpRouter.toWebHandler(ApiLayer)",
    prodLayer: "HttpRouter.serve(ApiLayer).pipe(Layer.provide(NodeHttpServer.layer(...)))",
    summary:
      "Contract-first REST endpoints with automatic Schema decoding, OpenAPI derivation, and backpressured Stream ingestion.",
  },
  {
    tier: "03. Durable Work & Retries",
    modules: "PersistedQueue · Schedule · Scope",
    stageId: "stage-07" as StageId,
    devLayer: "PersistedQueue.layerStoreMemory",
    prodLayer: "PersistedQueue.layerStoreSql(SqlClient) or PersistedQueue.layerStoreRedis(Redis)",
    summary:
      "At-least-once background job delivery with idempotency keys, scoped processing locks, and persisted retry schedules.",
  },
  {
    tier: "04. Distributed Virtual Actors",
    modules: "effect/cluster · Entity · Rpc · Sharding · SingleRunner / TestRunner",
    stageId: "stage-08" as StageId,
    devLayer: "TestRunner.layer (in-memory) / SingleRunner.layer (SQLite/Postgres)",
    prodLayer: "NodeClusterHttp / NodeClusterSocket + SqlMessageStorage + SqlRunnerStorage",
    summary:
      "Location-transparent stateful actors pinned to shards with concurrency: 1 serialized mailboxes and automatic idle passivation.",
  },
];

export function ArchitectureView(props: ArchitectureViewProps): JSX.Element {
  return (
    <section class="max-w-[1100px] mx-auto space-y-6">
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <h1 class="font-display text-2xl font-bold text-slate-900 text-balance">
          Full-Stack EffectTS Architecture Map
        </h1>
        <p class="text-sm text-slate-600 mt-2 max-w-[70ch] leading-relaxed">
          Because Effect separates program descriptions from Layer implementations, the
          same pipeline code runs seamlessly in unit tests, single-node containers, and
          multi-node Kubernetes clusters.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <For each={LAYERS}>
          {(layer) => (
            <article class="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
              <div>
                <h2 class="font-display text-base font-semibold text-slate-900">
                  {layer.tier}
                </h2>
                <p class="text-xs font-mono text-sky-800 mt-1">
                  {layer.modules}
                </p>
                <p class="text-sm text-slate-600 mt-3 leading-relaxed">
                  {layer.summary}
                </p>

                <dl class="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                  <div>
                    <dt class="font-semibold text-slate-700">Dev / Test Layer</dt>
                    <dd class="font-mono text-slate-600 mt-0.5">{layer.devLayer}</dd>
                  </div>
                  <div>
                    <dt class="font-semibold text-slate-700">Production Swap</dt>
                    <dd class="font-mono text-slate-600 mt-0.5">{layer.prodLayer}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => props.onOpenStage(layer.stageId)}
                  class="px-4 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Inspect in Workshop
                </button>
              </div>
            </article>
          )}
        </For>
      </div>
    </section>
  );
}
