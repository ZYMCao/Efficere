import type { StageExecutionResult, StageId } from "./types";
import { runStage01 } from "./stages/stage01Minimal";
import { runStage02 } from "./stages/stage02BasicsOption";
import { runStage03 } from "./stages/stage03ConfigSchema";
import { runStage04 } from "./stages/stage04PatternMatch";
import { runStage05 } from "./stages/stage05Stream";
import { runStage06 } from "./stages/stage06HttpApi";
import { runStage07 } from "./stages/stage07PersistedQueue";
import { runStage08 } from "./stages/stage08Cluster";

export function runStageById(stageId: StageId, input: Record<string, unknown>): Promise<StageExecutionResult> {
	switch (stageId) {
		case "stage-01":
			return runStage01(input);
		case "stage-02":
			return runStage02(input);
		case "stage-03":
			return runStage03(input);
		case "stage-04":
			return runStage04(input);
		case "stage-05":
			return runStage05(input);
		case "stage-06":
			return runStage06(input);
		case "stage-07":
			return runStage07(input);
		case "stage-08":
			return runStage08(input);
	}
}
