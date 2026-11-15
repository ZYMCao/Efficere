import { Effect, Layer, Ref, Schema, pipe } from "effect";
import { Entity, TestRunner } from "effect/cluster";
import { Rpc } from "effect/rpc";
import type { StageExecutionResult, TraceEvent } from "../types";

export interface Stage08Input {
	readonly tenantA?: string;
	readonly tenantB?: string;
	readonly messagesPerTenant?: number;
}

// 1. Define Actor RPC protocol
export class DailyLimitReached extends Schema.TaggedError<DailyLimitReached>()("DailyLimitReached", { tenantId: Schema.String, sentCount: Schema.Number }) {}

export const DispatchRpc = Rpc.make("Dispatch", {
	payload: { subject: Schema.NonEmptyString },
	success: Schema.Struct({
		entityAddress: Schema.String,
		shardId: Schema.String,
		sequenceNo: Schema.Number,
		subject: Schema.String,
	}),
	error: DailyLimitReached,
});

export const GetLedgerRpc = Rpc.make("GetLedger", {
	success: Schema.Struct({
		entityId: Schema.String,
		totalSent: Schema.Number,
		subjects: Schema.Array(Schema.String),
	}),
});

// 2. Define Cluster Entity (Virtual Actor)
export const TenantDispatcher = Entity.make("TenantDispatcher", [DispatchRpc, GetLedgerRpc]);

// 3. Implement Entity behavior as a Layer with isolated per-entity Ref state
interface TenantState {
	readonly totalSent: number;
	readonly subjects: ReadonlyArray<string>;
}

export const TenantDispatcherLive = TenantDispatcher.toLayer(
	pipe(
		Effect.Do,
		Effect.bind("address", () => Entity.CurrentAddress),
		Effect.bind("stateRef", () =>
			Ref.make<TenantState>({
				totalSent: 0,
				subjects: [],
			}),
		),
		Effect.map(({ address, stateRef }) =>
			TenantDispatcher.of({
				Dispatch: (envelope) =>
					pipe(
						Ref.modify(
							stateRef,
							(
								state,
							): readonly [
								Effect.Effect<
									{
										readonly entityAddress: string;
										readonly shardId: string;
										readonly sequenceNo: number;
										readonly subject: string;
									},
									DailyLimitReached
								>,
								TenantState,
							] => {
								if (state.totalSent >= 3) {
									return [
										Effect.fail(
											new DailyLimitReached({
												tenantId: address.entityId,
												sentCount: state.totalSent,
											}),
										),
										state,
									];
								}
								const nextSeq = state.totalSent + 1;
								const nextState: TenantState = {
									totalSent: nextSeq,
									subjects: [...state.subjects, envelope.payload.subject],
								};
								return [
									Effect.succeed({
										entityAddress: `${address.entityType}/${address.entityId}`,
										shardId: String(address.shardId),
										sequenceNo: nextSeq,
										subject: envelope.payload.subject,
									}),
									nextState,
								];
							},
						),
						Effect.flatten,
					),
				GetLedger: () =>
					pipe(
						Ref.get(stateRef),
						Effect.map((state) => ({
							entityId: address.entityId,
							totalSent: state.totalSent,
							subjects: [...state.subjects],
						})),
					),
			}),
		),
	),
	{ maxIdleTime: "5 minutes", concurrency: 1 },
);

export const runStage08 = (input: Stage08Input): Promise<StageExecutionResult> => {
	const startedAt = performance.now();
	const tenantA = (input.tenantA ?? "tenant-acme").trim() || "tenant-acme";
	const tenantB = (input.tenantB ?? "tenant-globex").trim() || "tenant-globex";
	const burstCount = Math.max(1, Math.min(4, Number(input.messagesPerTenant ?? 2)));
	const trace: Array<TraceEvent> = [];

	const pushTrace = (module: string, label: string, detail: string, status: TraceEvent["status"] = "ok") => {
		trace.push({
			step: trace.length + 1,
			module,
			label,
			detail,
			elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
			status,
		});
	};

	const ClusterLayer = TenantDispatcherLive.pipe(Layer.provideMerge(TestRunner.layer));

	// Pure pipeline: obtain sharded entity client -> send concurrent bursts -> read isolated actor state
	const program = pipe(
		TenantDispatcher.client,
		Effect.flatMap((makeClient) => {
			const acmeClient = makeClient(tenantA);
			const globexClient = makeClient(tenantB);

			const acmeCalls = Array.from({ length: burstCount }, (_, idx) =>
				pipe(
					acmeClient.Dispatch({ subject: `Acme Event #${idx + 1}` }),
					Effect.tap((res) => Effect.sync(() => pushTrace("Cluster.Entity", `${res.entityAddress}`, `Seq=${res.sequenceNo} on shard=${res.shardId}: "${res.subject}"`))),
					Effect.catchTag("DailyLimitReached", (err) =>
						Effect.sync(() => {
							pushTrace("Cluster.Entity", `${err.tenantId} DailyLimitReached`, `Actor rejected 4th message (cap=3) without corrupting state`, "warn");
							return { rejected: true, tenantId: err.tenantId, cap: 3 };
						}),
					),
				),
			);

			const globexCall = pipe(
				globexClient.Dispatch({ subject: "Globex Settlement #1" }),
				Effect.tap((res) => Effect.sync(() => pushTrace("Cluster.Entity", `${res.entityAddress}`, `Isolated actor Seq=${res.sequenceNo} on shard=${res.shardId}`))),
			);

			return pipe(
				Effect.Do,
				Effect.bind("acmeDispatches", () => Effect.all(acmeCalls, { concurrency: "unbounded" })),
				Effect.bind("globexDispatches", () => Effect.all([globexCall])),
				Effect.bind("acmeLedger", () => acmeClient.GetLedger()),
				Effect.bind("globexLedger", () => globexClient.GetLedger()),
			);
		}),
		Effect.scoped,
		Effect.provide(ClusterLayer),
	);

	return Effect.runPromise(program).then((output) => ({
		stageId: "stage-08",
		ok: true,
		statusLabel: "COMPLETED",
		durationMs: Number((performance.now() - startedAt).toFixed(2)),
		output,
		trace,
		stateSnapshot: {
			runnerMode: "TestRunner.layer (swap for SingleRunner.layer + SqlClient or NodeClusterHttp in prod)",
			actorGuarantees: "Single-writer serialized mailbox (concurrency=1), shard-routed by EntityId, automatic passivation",
		},
	}));
};
