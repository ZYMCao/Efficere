import type { CurriculumStage } from "../effect-curriculum/types";

export interface DiffLine {
  readonly type: "same" | "added" | "removed";
  readonly text: string;
}

export function computeLineDiff(
  previousText: string,
  currentText: string
): ReadonlyArray<DiffLine> {
  const prevLines = previousText.split("\n");
  const currLines = currentText.split("\n");

  const n = prevLines.length;
  const m = currLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0)
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (prevLines[i] === currLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: Array<DiffLine> = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (prevLines[i] === currLines[j]) {
      result.push({ type: "same", text: currLines[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: prevLines[i] });
      i++;
    } else {
      result.push({ type: "added", text: currLines[j] });
      j++;
    }
  }

  while (i < n) {
    result.push({ type: "removed", text: prevLines[i] });
    i++;
  }

  while (j < m) {
    result.push({ type: "added", text: currLines[j] });
    j++;
  }

  return result;
}

export function filterStagesByPrimitive(
  stages: ReadonlyArray<CurriculumStage>,
  query: string
): ReadonlyArray<CurriculumStage> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return stages;
  return stages.filter(
    (s) =>
      s.title.toLowerCase().includes(normalized) ||
      s.shortTitle.toLowerCase().includes(normalized) ||
      s.primitives.some((p) => p.toLowerCase().includes(normalized)) ||
      s.summary.toLowerCase().includes(normalized)
  );
}

export function buildDefaultFieldValues(
  stage: CurriculumStage
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const field of stage.fields) {
    out[field.key] = field.defaultValue;
  }
  return out;
}
