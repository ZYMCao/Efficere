import { createMemo, For, Match, Show, Switch } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { CurriculumStage, StageExecutionResult } from "../effect-curriculum/types";
import { AlertTriangleIcon, CheckCircleIcon, PlayIcon, RotateCcwIcon, XCircleIcon } from "./Icons";

interface ExecutionDeckProps {
	readonly stage: CurriculumStage;
	readonly values: Readonly<Record<string, string | number | boolean>>;
	readonly onChangeValue: (key: string, value: string | number | boolean) => void;
	readonly onRun: () => void;
	readonly onReset: () => void;
	readonly isRunning: boolean;
	readonly result: StageExecutionResult | null;
	readonly errorMessage: string | null;
}

export function ExecutionDeck(props: ExecutionDeckProps): JSX.Element {
	const matchedResult = createMemo(() => (props.result && props.result.stageId === props.stage.id ? props.result : null));

	return (
		<aside id="live-sandbox" aria-label="Live Effect runtime sandbox" class="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
			<div>
				<div class="flex items-baseline justify-between gap-2">
					<h2 class="font-display text-sm font-semibold text-slate-900">Live Runtime Sandbox</h2>
					<span class="text-xs text-slate-500">Effect v4 Runtime</span>
				</div>
				<p class="text-xs text-slate-500 mt-1">Adjust scenario inputs and execute Stage {props.stage.number} on the live runtime.</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					props.onRun();
				}}
				class="flex flex-col gap-3.5">
				<For each={props.stage.fields}>
					{(field) => {
						const inputId = createMemo(() => `field-${props.stage.id}-${field.key}`);
						const fieldValue = createMemo(() => props.values[field.key] ?? field.defaultValue);

						return (
							<Switch
								fallback={
									<div class="flex flex-col gap-1">
										<label for={inputId()} class="text-xs font-medium text-slate-700">
											{field.label}
										</label>
										<input
											id={inputId()}
											type={field.type}
											value={String(fieldValue())}
											onInput={(e) => props.onChangeValue(field.key, field.type === "number" ? (e.currentTarget.value === "" ? "" : Number(e.currentTarget.value)) : e.currentTarget.value)}
											class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white"
										/>
										<Show when={field.hint}>{(hint) => <span class="text-[11px] text-slate-500">{hint()}</span>}</Show>
									</div>
								}>
								<Match when={field.type === "boolean"}>
									<div class="flex items-start gap-2.5 pt-1">
										<input
											id={inputId()}
											type="checkbox"
											checked={Boolean(fieldValue())}
											onChange={(e) => props.onChangeValue(field.key, e.currentTarget.checked)}
											class="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600 cursor-pointer"
										/>
										<div class="flex flex-col">
											<label for={inputId()} class="text-xs font-medium text-slate-800 cursor-pointer">
												{field.label}
											</label>
											<Show when={field.hint}>{(hint) => <span class="text-[11px] text-slate-500">{hint()}</span>}</Show>
										</div>
									</div>
								</Match>

								<Match when={field.type === "select" ? field.options : null}>
									{(options) => (
										<div class="flex flex-col gap-1">
											<label for={inputId()} class="text-xs font-medium text-slate-700">
												{field.label}
											</label>
											<select
												id={inputId()}
												value={String(fieldValue())}
												onChange={(e) => props.onChangeValue(field.key, e.currentTarget.value)}
												class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600 focus:bg-white">
												<For each={options()}>
													{(opt) => (
														<option value={opt.value} selected={String(fieldValue()) === opt.value}>
															{opt.label}
														</option>
													)}
												</For>
											</select>
											<Show when={field.hint}>{(hint) => <span class="text-[11px] text-slate-500">{hint()}</span>}</Show>
										</div>
									)}
								</Match>
							</Switch>
						);
					}}
				</For>

				<div class="flex items-center gap-2 pt-1">
					<button
						type="submit"
						disabled={props.isRunning}
						class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
						<PlayIcon class="w-3.5 h-3.5" />
						<span>{props.isRunning ? "Executing..." : `Execute Stage ${props.stage.number}`}</span>
					</button>
					<button
						type="button"
						onClick={() => props.onReset()}
						aria-label={`Reset Stage ${props.stage.number} inputs`}
						class="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer">
						<RotateCcwIcon class="w-3.5 h-3.5" />
						<span>Reset</span>
					</button>
				</div>
			</form>

			<Show when={props.errorMessage}>
				{(err) => (
					<div role="alert" class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
						<XCircleIcon class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
						<span>{err()}</span>
					</div>
				)}
			</Show>

			<Show when={!props.result && !props.errorMessage}>
				<div class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">Run Stage {props.stage.number} to inspect live fiber steps, typed exits, and state snapshots.</div>
			</Show>

			<Show when={matchedResult()}>
				{(res) => (
					<div class="flex flex-col gap-4 pt-3 border-t border-slate-200">
						<div class="flex items-center justify-between gap-2">
							<div class="inline-flex items-center gap-1.5 text-xs font-semibold">
								<Show
									when={res().ok}
									fallback={
										<>
											<AlertTriangleIcon class="w-4 h-4 text-rose-600" />
											<span class="text-rose-800">
												{res().statusLabel}
												{res().errorTag ? ` (${res().errorTag})` : ""}
											</span>
										</>
									}>
									<CheckCircleIcon class="w-4 h-4 text-emerald-600" />
									<span class="text-emerald-800">{res().statusLabel}</span>
								</Show>
							</div>
							<span class="text-xs text-slate-500 font-mono tabular-nums">{res().durationMs.toFixed(2)} ms</span>
						</div>

						<div>
							<h3 class="text-xs font-semibold text-slate-800 mb-2">Execution Trace</h3>
							<div class="border border-slate-200 rounded-lg overflow-hidden">
								<table class="w-full text-left border-collapse text-xs">
									<thead class="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
										<tr>
											<th class="py-1.5 px-2.5 font-medium">#</th>
											<th class="py-1.5 px-2.5 font-medium">Step</th>
											<th class="py-1.5 px-2.5 font-medium text-right">Time</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100">
										<For each={res().trace} keyed={false}>
											{(item) => (
												<tr class="align-top">
													<td class="py-2 px-2.5 font-mono text-slate-400 tabular-nums">{item().step}</td>
													<td class="py-2 px-2.5">
														<div class="font-medium text-slate-900">
															{item().module} · {item().label}
														</div>
														<div class="text-[11px] text-slate-600 mt-0.5 break-words">{item().detail}</div>
														<div class="text-[10px] font-semibold mt-0.5">
															<Show when={item().status === "ok"}>
																<span class="text-emerald-700">STATUS: OK</span>
															</Show>
															<Show when={item().status === "warn"}>
																<span class="text-amber-700">STATUS: RECOVERED / RETRY</span>
															</Show>
															<Show when={item().status === "error"}>
																<span class="text-rose-700">STATUS: TYPED FAILURE</span>
															</Show>
														</div>
													</td>
													<td class="py-2 px-2.5 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">{item().elapsedMs.toFixed(1)}ms</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</div>

						<div>
							<h3 class="text-xs font-semibold text-slate-800 mb-1.5">Materialized Output</h3>
							<pre class="bg-slate-950 text-slate-100 p-3 rounded-lg text-[11px] leading-5 font-mono overflow-x-auto max-h-64">{JSON.stringify(res().output, null, 2)}</pre>
						</div>

						<Show when={res().stateSnapshot}>
							{(snap) => (
								<div>
									<h3 class="text-xs font-semibold text-slate-800 mb-1.5">Runtime Context & Guarantees</h3>
									<pre class="bg-slate-100 text-slate-800 border border-slate-200 p-3 rounded-lg text-[11px] leading-5 font-mono overflow-x-auto">{JSON.stringify(snap(), null, 2)}</pre>
								</div>
							)}
						</Show>
					</div>
				)}
			</Show>
		</aside>
	);
}
