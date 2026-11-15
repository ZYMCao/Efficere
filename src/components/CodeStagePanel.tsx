import { createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { CurriculumStage } from "../effect-curriculum/types";
import { computeLineDiff } from "../utils/curriculumHelpers";
import { CheckIcon, CopyIcon } from "./Icons";

const TOKEN_RE =
	/(\/\/.*$|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b(?:import|from|export|const|class|extends|type|readonly|new|return)\b|\b(?:Effect|Context|Layer|Option|Config|ConfigProvider|Redacted|Schema|Match|Stream|HttpApi|HttpApiGroup|HttpApiEndpoint|HttpApiBuilder|HttpApiSchema|HttpRouter|HttpServer|PersistedQueue|Schedule|Entity|Rpc|Ref|TestRunner|pipe)\b)/g;

function highlightLine(line: string): JSX.Element {
	if (!line) return " ";
	const parts: Array<JSX.Element> = [];
	let lastIdx = 0;
	let match: RegExpExecArray | null;
	TOKEN_RE.lastIndex = 0;
	while ((match = TOKEN_RE.exec(line)) !== null) {
		if (match.index > lastIdx) {
			parts.push(<span class="text-slate-100">{line.slice(lastIdx, match.index)}</span>);
		}
		const token = match[0];
		let cls = "text-sky-300 font-medium";
		if (token.startsWith("//")) {
			cls = "text-slate-400 italic";
		} else if (token.startsWith('"') || token.startsWith("`")) {
			cls = "text-emerald-300";
		} else if (/^(import|from|export|const|class|extends|type|readonly|new|return)$/.test(token)) {
			cls = "text-amber-300";
		}
		parts.push(<span class={cls}>{token}</span>);
		lastIdx = match.index + token.length;
	}
	if (lastIdx < line.length) {
		parts.push(<span class="text-slate-100">{line.slice(lastIdx)}</span>);
	}
	return parts;
}

export type CodeTabMode = "code" | "diff" | "notes";

interface CodeStagePanelProps {
	readonly stage: CurriculumStage;
	readonly previousStage: CurriculumStage | null;
	readonly activeTab: CodeTabMode;
	readonly onChangeTab: (tab: CodeTabMode) => void;
}

const TAB_BASE = "px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer";
const TAB_ACTIVE = "bg-white text-slate-900 shadow-sm";
const TAB_INACTIVE = "text-slate-600 hover:text-slate-900";

export function CodeStagePanel(props: CodeStagePanelProps): JSX.Element {
	const [copied, setCopied] = createSignal(false);

	function handleCopy() {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			navigator.clipboard.writeText(props.stage.code).catch(() => {});
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		}
	}

	const codeLines = createMemo(() => props.stage.code.split("\n"));
	const diffLines = createMemo(() => (props.previousStage && props.activeTab === "diff" ? computeLineDiff(props.previousStage.code, props.stage.code) : []));

	return (
		<section aria-label={`Stage ${props.stage.number} code and mental model`} class="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
			<div class="p-5 border-b border-slate-200">
				<div class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
					<h1 class="font-display text-xl font-bold text-slate-900 text-balance">
						{props.stage.number}. {props.stage.title}
					</h1>
					<span class="text-xs text-slate-500">Pipelines Only · Zero Generators</span>
				</div>

				<p class="text-sm text-slate-600 leading-relaxed max-w-[72ch]">{props.stage.summary}</p>

				<div class="mt-3 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
					<span class="font-medium text-slate-700">Primitives:</span>
					<For each={props.stage.primitives} keyed={false}>
						{(prim, idx) => (
							<span class="inline-flex items-center gap-2">
								<span class="font-mono text-sky-800">{prim()}</span>
								<Show when={idx < props.stage.primitives.length - 1}>
									<span aria-hidden="true" class="text-slate-300">
										·
									</span>
								</Show>
							</span>
						)}
					</For>
				</div>
			</div>

			<div class="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
				<div role="tablist" aria-label="Stage inspection mode" class="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
					<button
						type="button"
						role="tab"
						aria-selected={props.activeTab === "code" ? "true" : "false"}
						onClick={() => props.onChangeTab("code")}
						class={[
							TAB_BASE,
							{
								[TAB_ACTIVE]: props.activeTab === "code",
								[TAB_INACTIVE]: props.activeTab !== "code",
							},
						]}>
						Pipeline Code
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={props.activeTab === "diff" ? "true" : "false"}
						disabled={!props.previousStage}
						onClick={() => props.onChangeTab("diff")}
						class={[
							TAB_BASE,
							"disabled:opacity-45 disabled:cursor-not-allowed",
							{
								[TAB_ACTIVE]: props.activeTab === "diff",
								[TAB_INACTIVE]: props.activeTab !== "diff",
							},
						]}>
						{props.previousStage ? `Diff vs Stage ${props.previousStage.number}` : "Initial Stage"}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={props.activeTab === "notes" ? "true" : "false"}
						onClick={() => props.onChangeTab("notes")}
						class={[
							TAB_BASE,
							{
								[TAB_ACTIVE]: props.activeTab === "notes",
								[TAB_INACTIVE]: props.activeTab !== "notes",
							},
						]}>
						Best Practices
					</button>
				</div>

				<button
					type="button"
					onClick={handleCopy}
					aria-label="Copy pipeline TypeScript code"
					class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer">
					<Show
						when={copied()}
						fallback={
							<>
								<CopyIcon class="w-3.5 h-3.5 text-slate-500" />
								<span>Copy Code</span>
							</>
						}>
						<CheckIcon class="w-3.5 h-3.5 text-emerald-600" />
						<span>Copied</span>
					</Show>
				</button>
			</div>

			<Show when={props.activeTab === "code"}>
				<div class="bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs leading-6 font-mono">
					<pre class="m-0">
						<For each={codeLines()} keyed={false}>
							{(line, i) => (
								<div class="flex gap-4 hover:bg-slate-900/70 px-1 rounded">
									<span class="select-none text-slate-500 w-6 text-right shrink-0 tabular-nums">{i + 1}</span>
									<code class="whitespace-pre">{highlightLine(line())}</code>
								</div>
							)}
						</For>
					</pre>
				</div>
			</Show>

			<Show when={props.activeTab === "diff" ? props.previousStage : null}>
				{(prev) => (
					<div class="bg-slate-950 text-slate-100 p-4 overflow-x-auto text-xs leading-6 font-mono">
						<div class="text-[11px] text-slate-400 mb-3 pb-2 border-b border-slate-800">
							Comparing Stage {prev().number} ({prev().shortTitle}) → Stage {props.stage.number} ({props.stage.shortTitle})
						</div>
						<pre class="m-0">
							<For each={diffLines()} keyed={false}>
								{(line) => (
									<div
										class={[
											"flex gap-3 px-2 rounded",
											{
												"bg-emerald-950/70 text-emerald-200": line().type === "added",
												"bg-rose-950/60 text-rose-300": line().type === "removed",
												"text-slate-300": line().type === "same",
											},
										]}>
										<span class="select-none w-4 shrink-0 font-semibold">{line().type === "added" ? "+" : line().type === "removed" ? "-" : " "}</span>
										<code class="whitespace-pre">{line().text || " "}</code>
									</div>
								)}
							</For>
						</pre>
					</div>
				)}
			</Show>

			<Show when={props.activeTab === "notes"}>
				<div class="p-6 space-y-6 bg-white">
					<div>
						<h3 class="font-display text-sm font-semibold text-slate-900 mb-1.5">Mental Model</h3>
						<p class="text-sm text-slate-600 leading-relaxed max-w-[68ch]">{props.stage.mentalModel}</p>
					</div>
					<div class="pt-5 border-t border-slate-100">
						<h3 class="font-display text-sm font-semibold text-slate-900 mb-1.5">Pipeline-Only Technique</h3>
						<p class="text-sm text-slate-600 leading-relaxed max-w-[68ch]">{props.stage.pipelineSpotlight}</p>
					</div>
					<div class="pt-5 border-t border-slate-100">
						<h3 class="font-display text-sm font-semibold text-slate-900 mb-1.5">Production Best Practice</h3>
						<p class="text-sm text-slate-600 leading-relaxed max-w-[68ch]">{props.stage.bestPractice}</p>
					</div>
				</div>
			</Show>
		</section>
	);
}
