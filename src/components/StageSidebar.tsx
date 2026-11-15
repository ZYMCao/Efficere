import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { CurriculumStage, StageId } from "../effect-curriculum/types";
import { CheckIcon, SearchIcon } from "./Icons";

interface StageSidebarProps {
  readonly stages: ReadonlyArray<CurriculumStage>;
  readonly currentStageId: StageId;
  readonly completedStages: Readonly<Record<string, boolean>>;
  readonly completedCount: number;
  readonly searchQuery: string;
  readonly onSearchChange: (q: string) => void;
  readonly onSelectStage: (stageId: StageId) => void;
}

export function StageSidebar(props: StageSidebarProps): JSX.Element {
  return (
    <aside
      aria-label="Progressive curriculum stages"
      class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4"
    >
      <div>
        <div class="flex items-baseline justify-between gap-2 mb-2">
          <h2 class="font-display text-sm font-semibold text-slate-900">Progressive Path</h2>
          <span class="text-xs text-slate-500 tabular-nums">
            {props.completedCount} / 8 verified
          </span>
        </div>

        <label for="stage-filter" class="sr-only">
          Filter stages by module or keyword
        </label>
        <div class="relative">
          <SearchIcon class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="stage-filter"
            type="search"
            value={props.searchQuery}
            onInput={(e) => props.onSearchChange(e.currentTarget.value)}
            placeholder="Filter by module (e.g. Stream, Cluster)"
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600 focus:bg-white"
          />
        </div>
      </div>

      <nav aria-label="Curriculum stage list" class="flex flex-col gap-1.5">
        <Show
          when={props.stages.length > 0}
          fallback={
            <p class="text-xs text-slate-500 py-4 text-center">
              No stages match "{props.searchQuery}".
            </p>
          }
        >
          <For each={props.stages}>
            {(stage) => {
              const isSelected = createMemo(() => stage.id === props.currentStageId);
              const isDone = createMemo(() => Boolean(props.completedStages[stage.id]));

              return (
                <button
                  type="button"
                  onClick={() => props.onSelectStage(stage.id)}
                  aria-current={isSelected() ? "page" : undefined}
                  class={[
                    "w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600",
                    {
                      "bg-sky-50 border-sky-300 text-slate-900": isSelected(),
                      "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700":
                        !isSelected(),
                    },
                  ]}
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-slate-900">
                      {stage.number}. {stage.shortTitle}
                    </span>
                    <Show when={isDone()}>
                      <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 shrink-0">
                        <CheckIcon class="w-3 h-3" />
                        <span>Run</span>
                      </span>
                    </Show>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-1 truncate">
                    {stage.primitives.join(" · ")}
                  </p>
                </button>
              );
            }}
          </For>
        </Show>
      </nav>
    </aside>
  );
}
