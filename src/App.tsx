import {
  createMemo,
  createSignal,
  createStore,
  Match,
  onSettled,
  snapshot,
  Switch,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { CURRICULUM_STAGES } from "./effect-curriculum/catalog";
import type {
  StageExecutionResult,
  StageId,
} from "./effect-curriculum/types";
import {
  buildDefaultFieldValues,
  filterStagesByPrimitive,
} from "./utils/curriculumHelpers";
import { TopNav, type AppSection } from "./components/TopNav";
import { SignalFlowDiagram } from "./components/SignalFlowDiagram";
import { StageSidebar } from "./components/StageSidebar";
import { CodeStagePanel, type CodeTabMode } from "./components/CodeStagePanel";
import { ExecutionDeck } from "./components/ExecutionDeck";
import { PipelineRulesView } from "./components/PipelineRulesView";
import { ArchitectureView } from "./components/ArchitectureView";

function buildInitialInputs(): Record<
  StageId,
  Record<string, string | number | boolean>
> {
  const initial = {} as Record<
    StageId,
    Record<string, string | number | boolean>
  >;
  for (const s of CURRICULUM_STAGES) {
    initial[s.id] = buildDefaultFieldValues(s);
  }
  return initial;
}

export default function App(): JSX.Element {
  const [activeSection, setActiveSection] =
    createSignal<AppSection>("curriculum");
  const [currentStageId, setCurrentStageId] = createSignal<StageId>("stage-01");
  const [codeTab, setCodeTab] = createSignal<CodeTabMode>("code");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [completedStages, setCompletedStages] = createStore<
    Record<string, boolean>
  >({});
  const [inputsByStage, setInputsByStage] = createStore(buildInitialInputs());
  const [isRunning, setIsRunning] = createSignal(false);
  const [result, setResult] = createSignal<StageExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const currentIndex = createMemo(() =>
    CURRICULUM_STAGES.findIndex((s) => s.id === currentStageId())
  );
  const currentStage = createMemo(
    () => CURRICULUM_STAGES[currentIndex()] ?? CURRICULUM_STAGES[0]
  );
  const previousStage = createMemo(() =>
    currentIndex() > 0 ? CURRICULUM_STAGES[currentIndex() - 1] : null
  );
  const filteredStages = createMemo(() =>
    filterStagesByPrimitive(CURRICULUM_STAGES, searchQuery())
  );
  const completedCount = createMemo(
    () => Object.values(completedStages).filter(Boolean).length
  );

  const executeStage = async (
    stageId: StageId,
    payload: Record<string, string | number | boolean>
  ) => {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/stages/${stageId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as StageExecutionResult;
      setResult(data);
      setCompletedStages((s) => {
        s[stageId] = true;
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run stage"
      );
    } finally {
      setIsRunning(false);
    }
  };

  // Run Stage 01 on initial load so user sees live Effect execution immediately
  onSettled(() => {
    void executeStage("stage-01", snapshot(inputsByStage["stage-01"]));
  });

  const handleSelectStage = (stageId: StageId) => {
    setCurrentStageId(stageId);
    setActiveSection("curriculum");
    if (stageId === "stage-01" && codeTab() === "diff") {
      setCodeTab("code");
    }
    void executeStage(stageId, snapshot(inputsByStage[stageId]));
  };

  const handleChangeField = (
    key: string,
    value: string | number | boolean
  ) => {
    const stageId = currentStage().id;
    setInputsByStage((s) => {
      s[stageId][key] = value;
    });
  };

  const handleResetInputs = () => {
    const stage = currentStage();
    const defaults = buildDefaultFieldValues(stage);
    setInputsByStage((s) => {
      s[stage.id] = defaults;
    });
    void executeStage(stage.id, defaults);
  };

  const handleJumpToSandbox = () => {
    setActiveSection("curriculum");
    setTimeout(() => {
      document.getElementById("live-sandbox")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  return (
    <div id="top" class="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav
        activeSection={activeSection()}
        onSelectSection={setActiveSection}
        onJumpToSandbox={handleJumpToSandbox}
        onRunCurrentStage={() =>
          void executeStage(
            currentStage().id,
            snapshot(inputsByStage[currentStage().id])
          )
        }
        isRunning={isRunning()}
      />

      <main class="flex-1 w-full max-w-[1440px] mx-auto px-6 py-6">
        <Switch>
          <Match when={activeSection() === "curriculum"}>
            <div class="flex flex-col gap-5">
              <SignalFlowDiagram
                activeNodes={currentStage().activeNodes}
                currentStageId={currentStage().id}
                onSelectStage={handleSelectStage}
              />

              <div class="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_370px] gap-5 items-start">
                <div>
                  <StageSidebar
                    stages={filteredStages()}
                    currentStageId={currentStage().id}
                    completedStages={completedStages}
                    completedCount={completedCount()}
                    searchQuery={searchQuery()}
                    onSearchChange={setSearchQuery}
                    onSelectStage={handleSelectStage}
                  />
                </div>

                <div class="min-w-0">
                  <CodeStagePanel
                    stage={currentStage()}
                    previousStage={previousStage()}
                    activeTab={codeTab()}
                    onChangeTab={setCodeTab}
                  />
                </div>

                <div>
                  <ExecutionDeck
                    stage={currentStage()}
                    values={inputsByStage[currentStage().id]}
                    onChangeValue={handleChangeField}
                    onRun={() =>
                      void executeStage(
                        currentStage().id,
                        snapshot(inputsByStage[currentStage().id])
                      )
                    }
                    onReset={handleResetInputs}
                    isRunning={isRunning()}
                    result={result()}
                    errorMessage={errorMessage()}
                  />
                </div>
              </div>
            </div>
          </Match>

          <Match when={activeSection() === "pipeline-rules"}>
            <PipelineRulesView />
          </Match>

          <Match when={activeSection() === "architecture"}>
            <ArchitectureView onOpenStage={handleSelectStage} />
          </Match>
        </Switch>
      </main>
    </div>
  );
}
