import { Effect, Match, Schema, Stream, pipe } from "effect";
import type { StageExecutionResult, TraceEvent } from "../types";
import { DispatchCommandSchema, computeRoutingPlan } from "./stage04PatternMatch";

export interface Stage05Input {
	readonly concurrency?: number;
	readonly minUrgency?: number;
}

const sampleBatch: ReadonlyArray<unknown> = [
	{ _tag: "SendEmail", to: "ops@acme.dev", subject: "DB Failover", urgency: 5 },
	{ _tag: "SendEmail", to: "digest@acme.dev", subject: "Weekly Summary", urgency: 1 },
	{ _tag: "SendSms", phone: "+14155550199", body: "OTP: 882411" },
	{ _tag: "WebhookPush", endpoint: "https://hooks.acme.dev/ledger", retries: 3 },
	{ _tag: "SendEmail", to: "security@acme.dev", subject: "Key Rotated", urgency: 4 },
];

export function runStage05(input: Stage05Input): Promise<StageExecutionResult> {
	const startedAt = performance.now();
	const concurrency = Math.max(1, Math.min(5, Number(input.concurrency ?? 2)));
	const minUrgency = Math.max(1, Math.min(5, Number(input.minUrgency ?? 2)));
	const trace: Array<TraceEvent> = [];

	function pushTrace(module: string, label: string, detail: string, status: TraceEvent["status"] = "ok") {
		trace.push({
			step: trace.length + 1,
			module,
			label,
			detail,
			elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
			status,
		});
	}

	pushTrace("Stream", "Stream.fromIterable", `Queued ${sampleBatch.length} raw events (concurrency=${concurrency}, minUrgency=${minUrgency})`);

	// Pure pipeline Stream: decode -> filter -> concurrent mapEffect -> runCollect
	const pipeline = pipe(
		Stream.fromIterable(sampleBatch),
		Stream.mapEffect((raw) => Schema.decodeUnknownEffect(DispatchCommandSchema)(raw), {
			concurrency,
		}),
		Stream.filter((cmd) =>
			Match.value(cmd).pipe(
				Match.tag("SendEmail", (email) => email.urgency >= minUrgency),
				Match.orElse(() => true),
			),
		),
		Stream.mapEffect(
			(cmd) =>
				pipe(
					Effect.sleep("15 millis"),
					Effect.map(() => {
						const plan = computeRoutingPlan(cmd);
						pushTrace("Stream.mapEffect", `Processed ${cmd._tag}`, `-> ${plan.transport} (${plan.target})`);
						return { tag: cmd._tag, ...plan };
					}),
				),
			{ concurrency },
		),
		Stream.runCollect,
	);

	return Effect.runPromise(pipeline).then((processed) => ({
		stageId: "stage-05",
		ok: true,
		statusLabel: "COMPLETED",
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		output: {
			ingestedCount: sampleBatch.length,
			emittedCount: processed.length,
			filteredOut: sampleBatch.length - processed.length,
			concurrency,
			processed,
		},
		trace,
	}));
}
