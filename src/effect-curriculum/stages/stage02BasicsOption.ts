import { Context, Effect, Exit, Layer, Option, Schema, pipe } from "effect";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage02Input {
	readonly recipientId?: string;
	readonly costUnits?: number;
}

// 1. Schema-backed typed domain errors (no throw, no untyped catch)
export class RecipientNotFound extends Schema.TaggedError<RecipientNotFound>()("RecipientNotFound", { recipientId: Schema.String }) {}

export class QuotaExceeded extends Schema.TaggedError<QuotaExceeded>()("QuotaExceeded", {
	recipientId: Schema.String,
	requested: Schema.Number,
	remaining: Schema.Number,
}) {}

export interface RecipientRecord {
	readonly id: string;
	readonly email: string;
	readonly remainingQuota: number;
}

export class RecipientRepo extends Context.Service<
	RecipientRepo,
	{
		readonly findById: (id: string) => Effect.Effect<Option.Option<RecipientRecord>>;
	}
>()("RecipientRepo") {}

// 2. Pure pipeline using Effect.Do + Effect.bind + Option + typed errors
export function prepareDispatch(recipientId: string, costUnits: number) {
	return pipe(
		Effect.Do,
		Effect.bind("maybeRecipient", () => RecipientRepo.use((repo) => repo.findById(recipientId))),
		Effect.bind("recipient", ({ maybeRecipient }) =>
			pipe(
				maybeRecipient,
				Option.match({
					onNone: () => Effect.fail(new RecipientNotFound({ recipientId })),
					onSome: Effect.succeed,
				}),
			),
		),
		Effect.flatMap(({ recipient }) =>
			recipient.remainingQuota < costUnits
				? Effect.fail(
						new QuotaExceeded({
							recipientId: recipient.id,
							requested: costUnits,
							remaining: recipient.remainingQuota,
						}),
					)
				: Effect.succeed({
						recipientId: recipient.id,
						email: recipient.email,
						reservedUnits: costUnits,
						remainingAfter: recipient.remainingQuota - costUnits,
					}),
		),
	);
}

export function runStage02(input: Stage02Input): Promise<StageExecutionResult> {
	const startedAt = performance.now();
	const recipientId = (input.recipientId ?? "acct-acme").trim();
	const costUnits = Number(input.costUnits ?? 3);
	const trace: Array<TraceEvent> = [];

	const directory: Record<string, RecipientRecord> = {
		"acct-acme": { id: "acct-acme", email: "alerts@acme.dev", remainingQuota: 10 },
		"acct-low": { id: "acct-low", email: "billing@lowquota.io", remainingQuota: 2 },
	};

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

	const RepoLive = Layer.succeed(RecipientRepo, {
		findById: (id) =>
			Effect.sync(() => {
				const found = Option.fromNullishOr(directory[id]);
				pushTrace("Option", "Option.fromNullishOr", Option.isSome(found) ? `Some(${found.value.email}, quota=${found.value.remainingQuota})` : `None() for "${id}"`, Option.isSome(found) ? "ok" : "warn");
				return found;
			}),
	});

	// 3. Demonstrate typed error channel inspection + recovery via Effect.catchTag
	const programWithRecovery = pipe(
		prepareDispatch(recipientId, costUnits),
		Effect.tap((ok) => Effect.sync(() => pushTrace("Effect", "prepareDispatch", `Reserved ${ok.reservedUnits} units for ${ok.email}`))),
		Effect.catchTag("QuotaExceeded", (err) =>
			Effect.sync(() => {
				pushTrace("Effect.catchTag", "Recovered QuotaExceeded", `Requested ${err.requested} > remaining ${err.remaining}; downgraded to 1 unit`, "warn");
				return {
					recipientId: err.recipientId,
					email: directory[err.recipientId]?.email ?? "fallback@acme.dev",
					reservedUnits: 1,
					remainingAfter: Math.max(0, err.remaining - 1),
					recoveredFrom: "QuotaExceeded" as const,
				};
			}),
		),
		Effect.provide(RepoLive),
	);

	return Effect.runPromiseExit(programWithRecovery).then((exit) => {
		if (Exit.isSuccess(exit)) {
			return {
				stageId: "stage-02",
				ok: true,
				statusLabel: "COMPLETED",
				durationMs: Number((performance.now() - startedAt).toFixed(2)),
				output: exit.value,
				trace,
				stateSnapshot: {
					availableAccounts: Object.keys(directory),
					note: "QuotaExceeded is recovered via catchTag; RecipientNotFound stays in the typed error channel.",
				},
			};
		}

		pushTrace("Exit", "Unhandled Typed Failure", `Pipeline exited in E channel: ${String(exit.cause)}`, "error");

		return {
			stageId: "stage-02",
			ok: false,
			statusLabel: "TYPED_ERROR",
			durationMs: Number((performance.now() - startedAt).toFixed(2)),
			output: { cause: String(exit.cause) },
			errorTag: "RecipientNotFound",
			trace,
			stateSnapshot: {
				availableAccounts: Object.keys(directory),
			},
		};
	});
}
