import { Effect, Layer, Ref, Schedule, Schema, pipe } from "effect";
import { PersistedQueue } from "effect/persistence";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage07Input {
	readonly idempotencyKey?: string;
	readonly recipient?: string;
	readonly failFirstAttempt?: boolean;
	readonly sendDuplicateOffer?: boolean;
}

export const QueuedDispatchSchema = Schema.Struct({
	recipient: Schema.NonEmptyString,
	subject: Schema.NonEmptyString,
});

export class TransientSmtpError extends Schema.TaggedError<TransientSmtpError>()("TransientSmtpError", { attempt: Schema.Number, reason: Schema.String }) {}

export function runStage07(input: Stage07Input): Promise<StageExecutionResult> {
	const startedAt = performance.now();
	const idempotencyKey = (input.idempotencyKey ?? "order-9042").trim() || "order-9042";
	const recipient = (input.recipient ?? "finance@acme.dev").trim() || "finance@acme.dev";
	const failFirstAttempt = input.failFirstAttempt ?? true;
	const sendDuplicateOffer = input.sendDuplicateOffer ?? true;
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

	// Pure pipeline building PersistedQueue, offering with idempotency key, and taking with scoped retry
	const program = pipe(
		Effect.Do,
		Effect.bind("attemptLog", () => Ref.make<Array<string>>([])),
		Effect.bind("queue", () =>
			PersistedQueue.make({
				name: "dispatches-durable",
				schema: QueuedDispatchSchema,
				maxAttempts: 3,
				retrySchedule: Schedule.spaced("20 millis"),
			}),
		),
		Effect.bind("firstOfferId", ({ queue }) =>
			pipe(
				queue.offer({ recipient, subject: "Invoice #9042 Ready" }, { id: idempotencyKey, deduplicate: "untilRemoved" }),
				Effect.tap((id) => Effect.sync(() => pushTrace("PersistedQueue", "queue.offer (primary)", `Enqueued id="${id}" with deduplicate="untilRemoved"`))),
			),
		),
		Effect.bind("duplicateOfferId", ({ queue }) =>
			sendDuplicateOffer
				? pipe(
						queue.offer({ recipient, subject: "Invoice #9042 Duplicate" }, { id: idempotencyKey, deduplicate: "untilRemoved" }),
						Effect.tap((id) => Effect.sync(() => pushTrace("PersistedQueue", "queue.offer (duplicate)", `Deduplicated offer id="${id}" — ignored by store`, "warn"))),
					)
				: Effect.succeed<string | null>(null),
		),
		Effect.bind("workerOutcome", ({ queue, attemptLog }) => {
			const takeOnce = queue.take((item, metadata) =>
				pipe(
					Ref.update(attemptLog, (xs) => [...xs, `attempt=${metadata.attempts} id=${metadata.id}`]),
					Effect.flatMap(() => {
						if (failFirstAttempt && metadata.attempts === 1) {
							pushTrace("PersistedQueue.take", `Attempt #${metadata.attempts} failed`, `TransientSmtpError -> PersistedQueue schedules automatic retry`, "warn");
							return Effect.fail(
								new TransientSmtpError({
									attempt: metadata.attempts,
									reason: "Upstream SMTP 421 busy",
								}),
							);
						}
						pushTrace("PersistedQueue.take", `Attempt #${metadata.attempts} acknowledged`, `Delivered "${item.subject}" to ${item.recipient}`);
						return Effect.succeed({
							deliveredId: metadata.id,
							attemptsUsed: metadata.attempts,
							recipient: item.recipient,
							subject: item.subject,
						});
					}),
				),
			);

			// Retry outer worker loop when attempt 1 fails so we observe attempt 2 from the store
			return pipe(
				takeOnce,
				Effect.catchTag("TransientSmtpError", () => takeOnce),
			);
		}),
		Effect.bind("attemptsRecorded", ({ attemptLog }) => Ref.get(attemptLog)),
		Effect.map(({ firstOfferId, duplicateOfferId, workerOutcome, attemptsRecorded }) => ({
			firstOfferId,
			duplicateOfferId,
			deduplicated: duplicateOfferId === firstOfferId,
			workerOutcome,
			attemptsRecorded,
		})),
		Effect.provide(PersistedQueue.layer.pipe(Layer.provide(PersistedQueue.layerStoreMemory))),
	);

	return Effect.runPromise(program).then((output) => ({
		stageId: "stage-07",
		ok: true,
		statusLabel: "COMPLETED",
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		output,
		trace,
		stateSnapshot: {
			storeBackend: "PersistedQueue.layerStoreMemory (swap for layerStoreSql / layerStoreRedis in prod)",
			deliveryGuarantee: "At-least-once with scoped acknowledgement & idempotency keys",
		},
	}));
}
