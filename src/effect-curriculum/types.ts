export type StageId =
  | "stage-01"
  | "stage-02"
  | "stage-03"
  | "stage-04"
  | "stage-05"
  | "stage-06"
  | "stage-07"
  | "stage-08";

export interface TraceEvent {
  readonly step: number;
  readonly module: string;
  readonly label: string;
  readonly detail: string;
  readonly elapsedMs: number;
  readonly status: "ok" | "warn" | "error";
}

export interface StageExecutionResult {
  readonly stageId: StageId;
  readonly ok: boolean;
  readonly statusLabel: "COMPLETED" | "TYPED_ERROR" | "VALIDATION_FAILED";
  readonly durationMs: number;
  readonly output: unknown;
  readonly errorTag?: string;
  readonly trace: ReadonlyArray<TraceEvent>;
  readonly stateSnapshot?: Record<string, unknown>;
}

export interface ScenarioField {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "number" | "boolean" | "select";
  readonly defaultValue: string | number | boolean;
  readonly options?: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly hint?: string;
}

export interface CurriculumStage {
  readonly id: StageId;
  readonly number: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly primitives: ReadonlyArray<string>;
  readonly activeNodes: ReadonlyArray<string>;
  readonly summary: string;
  readonly mentalModel: string;
  readonly pipelineSpotlight: string;
  readonly bestPractice: string;
  readonly code: string;
  readonly fields: ReadonlyArray<ScenarioField>;
}
