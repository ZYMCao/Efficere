import { For } from "solid-js";
import type { JSX } from "@solidjs/web";
import { PIPELINE_RULES } from "../effect-curriculum/catalog";

export function PipelineRulesView(): JSX.Element {
	return (
		<section class="max-w-[1100px] mx-auto space-y-6">
			<div class="bg-white border border-slate-200 rounded-xl p-6">
				<h1 class="font-display text-2xl font-bold text-slate-900 text-balance">Pipeline-Only Discipline: Zero Generators, Zero Yields</h1>
				<p class="text-sm text-slate-600 mt-2 max-w-[70ch] leading-relaxed">
					Every stage in this curriculum avoids Effect.gen and yield*. Pure pipelines compose small combinators directly through pipe(...), preserving static variance in Effect&lt;A, E, R&gt; and keeping
					control flow explicit.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-5">
				<For each={PIPELINE_RULES}>
					{(rule, idx) => (
						<article class="bg-white border border-slate-200 rounded-xl p-6">
							<h2 class="font-display text-base font-semibold text-slate-900">
								0{idx() + 1}. {rule.topic}
							</h2>
							<p class="text-sm text-slate-600 mt-1.5 max-w-[70ch]">{rule.explanation}</p>

							<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
								<div>
									<div class="text-xs font-semibold text-rose-700 mb-1.5">Avoid: Generator Style</div>
									<pre class="bg-slate-950 text-rose-200 p-3.5 rounded-lg text-xs leading-6 font-mono overflow-x-auto">{rule.avoid}</pre>
								</div>
								<div>
									<div class="text-xs font-semibold text-emerald-700 mb-1.5">Prefer: Pure Pipeline Style</div>
									<pre class="bg-slate-950 text-emerald-200 p-3.5 rounded-lg text-xs leading-6 font-mono overflow-x-auto">{rule.prefer}</pre>
								</div>
							</div>
						</article>
					)}
				</For>
			</div>
		</section>
	);
}
