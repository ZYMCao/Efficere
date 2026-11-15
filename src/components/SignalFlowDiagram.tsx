import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { StageId } from "../effect-curriculum/types";
import { ArrowRightIcon } from "./Icons";

interface FlowNode {
  readonly id: string;
  readonly label: string;
  readonly stageId: StageId;
  readonly role: string;
}

const FLOW_NODES: ReadonlyArray<FlowNode> = [
  { id: "effect", label: "Effect + Layer", stageId: "stage-01", role: "Blueprint & DI" },
  { id: "option", label: "Option & Errors", stageId: "stage-02", role: "Null & E-Channel" },
  { id: "config", label: "Config & Schema", stageId: "stage-03", role: "Env & Codecs" },
  { id: "match", label: "Match", stageId: "stage-04", role: "Exhaustive Route" },
  { id: "stream", label: "Stream", stageId: "stage-05", role: "Backpressure" },
  { id: "httpapi", label: "HttpApi", stageId: "stage-06", role: "Typed HTTP Edge" },
  { id: "queue", label: "PersistedQueue", stageId: "stage-07", role: "Durable Retries" },
  { id: "cluster", label: "Cluster Entity", stageId: "stage-08", role: "Sharded Actors" },
];

interface SignalFlowDiagramProps {
  readonly activeNodes: ReadonlyArray<string>;
  readonly currentStageId: StageId;
  readonly onSelectStage: (stageId: StageId) => void;
}

export function SignalFlowDiagram(props: SignalFlowDiagramProps): JSX.Element {
  return (
    <section
      aria-label="Progressive EffectTS Architecture Flow"
      class="bg-white border border-slate-200 rounded-xl p-4"
    >
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 mb-3">
        <h2 class="font-display text-sm font-semibold text-slate-900">
          Evolving Dispatch Ledger Signal Flow
        </h2>
        <span class="text-xs text-slate-500 whitespace-nowrap">
          Click any node to jump to its stage
        </span>
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
        <For each={FLOW_NODES}>
          {(node, idx) => {
            const isCurrent = createMemo(() => node.stageId === props.currentStageId);
            const isActive = createMemo(
              () =>
                props.activeNodes.includes(node.id) ||
                (node.id === "config" && props.activeNodes.includes("schema"))
            );

            return (
              <div class="flex items-center gap-1.5 shrink-0 xl:flex-1 xl:min-w-0">
                <button
                  type="button"
                  onClick={() => props.onSelectStage(node.stageId)}
                  aria-current={isCurrent() ? "step" : undefined}
                  class={[
                    "w-full text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600",
                    {
                      "bg-sky-700 border-sky-700 text-white": isCurrent(),
                      "bg-sky-50 border-sky-200 text-sky-950 hover:border-sky-400":
                        !isCurrent() && isActive(),
                      "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300":
                        !isCurrent() && !isActive(),
                    },
                  ]}
                >
                  <div class="text-xs font-semibold whitespace-nowrap truncate">
                    {node.label}
                  </div>
                  <div
                    class={[
                      "text-[11px] whitespace-nowrap truncate",
                      {
                        "text-sky-100": isCurrent(),
                        "text-sky-700": !isCurrent() && isActive(),
                        "text-slate-400": !isCurrent() && !isActive(),
                      },
                    ]}
                  >
                    {node.role}
                  </div>
                </button>
                <Show when={idx() < FLOW_NODES.length - 1}>
                  <span
                    class={[
                      "shrink-0 inline-flex",
                      {
                        "text-sky-600": isActive(),
                        "text-slate-300": !isActive(),
                      },
                    ]}
                  >
                    <ArrowRightIcon class="w-3.5 h-3.5" />
                  </span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
}
