import test from "node:test";
import assert from "node:assert/strict";
import { CURRICULUM_STAGES } from "../effect-curriculum/catalog";
import { buildDefaultFieldValues, computeLineDiff, filterStagesByPrimitive } from "./curriculumHelpers";

test("computeLineDiff identifies added, removed, and unchanged lines", () => {
	const diff = computeLineDiff("a\nb\nc", "a\nx\nc\nd");
	assert.deepEqual(diff, [
		{ type: "same", text: "a" },
		{ type: "removed", text: "b" },
		{ type: "added", text: "x" },
		{ type: "same", text: "c" },
		{ type: "added", text: "d" },
	]);
});

test("filterStagesByPrimitive matches PersistedQueue and Cluster stages", () => {
	const pq = filterStagesByPrimitive(CURRICULUM_STAGES, "PersistedQueue");
	assert.equal(pq.length, 1);
	assert.equal(pq[0].id, "stage-07");

	const cluster = filterStagesByPrimitive(CURRICULUM_STAGES, "Entity");
	assert.equal(cluster.length, 1);
	assert.equal(cluster[0].id, "stage-08");
});

test("buildDefaultFieldValues populates every field key", () => {
	for (const stage of CURRICULUM_STAGES) {
		const defaults = buildDefaultFieldValues(stage);
		for (const f of stage.fields) {
			assert.equal(defaults[f.key], f.defaultValue);
		}
	}
});

test("Catalog code snippets contain zero Effect.gen, yield*, pipe(...), Effect.Do, or Effect.bind", () => {
	for (const stage of CURRICULUM_STAGES) {
		assert.equal(stage.code.includes("Effect.gen"), false, `${stage.id} snippet has Effect.gen`);
		assert.equal(stage.code.includes("yield*"), false, `${stage.id} snippet has yield*`);
		assert.equal(/(?<![.\w$])pipe\s*\(/.test(stage.code), false, `${stage.id} snippet calls pipe(...); use .pipe(...) method chaining`);
		assert.equal(stage.code.includes("Effect.Do"), false, `${stage.id} snippet has Effect.Do`);
		assert.equal(stage.code.includes("Effect.bind"), false, `${stage.id} snippet has Effect.bind; use Effect.flatMap`);
	}
});
