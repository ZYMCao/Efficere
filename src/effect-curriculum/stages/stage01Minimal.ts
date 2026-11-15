import { Context, Effect, Layer, pipe } from "effect";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage01Input {
	readonly recipient?: string;
	readonly message?: string;
}

// 1. Define services using Effect v4 Context.Service
export class LedgerClock extends Context.Service<LedgerClock, { readonly nowIso: Effect.Effect<string> }>()("LedgerClock") {}

export class AuditLog extends Context.Service<AuditLog, { readonly record: (entry: string) => Effect.Effect<void> }>()("AuditLog") {}

// 2. Pure pipeline program: Effect<{ id: string; entry: string }, never, LedgerClock | AuditLog>
export function recordDispatch(recipient: string, message: string) {
	return pipe(
		LedgerClock.use((clock) => clock.nowIso),
		Effect.flatMap((timestamp) =>
			pipe(
				Effect.succeed(`[${timestamp}] -> ${recipient}: ${message}`),
				Effect.tap((entry) => AuditLog.use((log) => log.record(entry))),
				Effect.map((entry) => ({
					id: `disp-${timestamp.slice(11, 19).replace(/:/g, "")}`,
					recipient,
					entry,
				})),
			),
		),
	);
}

export function runStage01(input: Stage01Input): Promise<StageExecutionResult> {
	const startedAt = performance.now();
	const recipient = (input.recipient ?? "ops@acme.dev").trim() || "ops@acme.dev";
	const message = (input.message ?? "Ledger booted cleanly").trim() || "Ledger booted cleanly";
	const logs: Array<string> = [];
	const trace: Array<TraceEvent> = [];

	function pushTrace(module: string, label: string, detail: string) {
		trace.push({
			step: trace.length + 1,
			module,
			label,
			detail,
			elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
			status: "ok",
		});
	}

	// 3. Provide implementations with Layer.succeed & Layer.mergeAll
	const ClockLive = Layer.succeed(LedgerClock, {
		nowIso: Effect.sync(() => {
			const iso = new Date().toISOString();
			pushTrace("Context.Service", "LedgerClock.nowIso", `Produced timestamp ${iso}`);
			return iso;
		}),
	});

	const AuditLogLive = Layer.succeed(AuditLog, {
		record: (entry) =>
			Effect.sync(() => {
				logs.push(entry);
				pushTrace("AuditLog", "AuditLog.record", entry);
			}),
	});

	const AppLayer = Layer.mergeAll(ClockLive, AuditLogLive);

	// 4. Wire dependencies at the edge with Effect.provide, then runPromise
	const runnable = pipe(
		recordDispatch(recipient, message),
		Effect.tap((res) => Effect.sync(() => pushTrace("Effect", "Effect.runPromise", `Materialized dispatch ${res.id}`))),
		Effect.provide(AppLayer),
	);

	return Effect.runPromise(runnable).then((output) => ({
		stageId: "stage-01",
		ok: true,
		statusLabel: "COMPLETED",
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		output,
		trace,
		stateSnapshot: {
			auditEntries: logs,
			requirementsRemaining: "never",
		},
	}));
}
