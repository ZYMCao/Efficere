import type { JSX } from "@solidjs/web";
import { PlayIcon } from "./Icons";

export type AppSection = "curriculum" | "pipeline-rules" | "architecture";

interface TopNavProps {
	readonly activeSection: AppSection;
	readonly onSelectSection: (section: AppSection) => void;
	readonly onJumpToSandbox: () => void;
	readonly onRunCurrentStage: () => void;
	readonly isRunning: boolean;
}

const NAV_BASE = "text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600";
const NAV_ACTIVE = "text-slate-900 border-sky-600";
const NAV_INACTIVE = "text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300";

export function TopNav(props: TopNavProps): JSX.Element {
	return (
		<header class="bg-white border-b border-slate-200 px-6 py-3.5">
			<div class="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
				<a
					href="#top"
					onClick={(e) => {
						e.preventDefault();
						props.onSelectSection("curriculum");
					}}
					class="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
					EffectTS Workshop
				</a>

				<nav aria-label="Primary navigation" class="hidden md:flex items-center gap-6">
					<button
						type="button"
						onClick={() => props.onSelectSection("curriculum")}
						class={[
							NAV_BASE,
							{
								[NAV_ACTIVE]: props.activeSection === "curriculum",
								[NAV_INACTIVE]: props.activeSection !== "curriculum",
							},
						]}>
						Curriculum
					</button>
					<button
						type="button"
						onClick={() => props.onSelectSection("pipeline-rules")}
						class={[
							NAV_BASE,
							{
								[NAV_ACTIVE]: props.activeSection === "pipeline-rules",
								[NAV_INACTIVE]: props.activeSection !== "pipeline-rules",
							},
						]}>
						Pipeline Rules
					</button>
					<button
						type="button"
						onClick={() => props.onSelectSection("architecture")}
						class={[
							NAV_BASE,
							{
								[NAV_ACTIVE]: props.activeSection === "architecture",
								[NAV_INACTIVE]: props.activeSection !== "architecture",
							},
						]}>
						Architecture
					</button>
					<button type="button" onClick={() => props.onJumpToSandbox()} class={[NAV_BASE, NAV_INACTIVE]}>
						Live Sandbox
					</button>
				</nav>

				<div class="shrink-0">
					<button
						type="button"
						onClick={() => props.onRunCurrentStage()}
						disabled={props.isRunning}
						class="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
						<PlayIcon class="w-3.5 h-3.5" />
						<span>{props.isRunning ? "Running..." : "Run Stage"}</span>
					</button>
				</div>
			</div>

			<nav aria-label="Mobile navigation" class="flex md:hidden items-center gap-5 pt-2.5 mt-2.5 border-t border-slate-100 overflow-x-auto">
				<button
					type="button"
					onClick={() => props.onSelectSection("curriculum")}
					class={[
						NAV_BASE,
						{
							[NAV_ACTIVE]: props.activeSection === "curriculum",
							[NAV_INACTIVE]: props.activeSection !== "curriculum",
						},
					]}>
					Curriculum
				</button>
				<button
					type="button"
					onClick={() => props.onSelectSection("pipeline-rules")}
					class={[
						NAV_BASE,
						{
							[NAV_ACTIVE]: props.activeSection === "pipeline-rules",
							[NAV_INACTIVE]: props.activeSection !== "pipeline-rules",
						},
					]}>
					Pipeline Rules
				</button>
				<button
					type="button"
					onClick={() => props.onSelectSection("architecture")}
					class={[
						NAV_BASE,
						{
							[NAV_ACTIVE]: props.activeSection === "architecture",
							[NAV_INACTIVE]: props.activeSection !== "architecture",
						},
					]}>
					Architecture
				</button>
				<button type="button" onClick={() => props.onJumpToSandbox()} class={[NAV_BASE, NAV_INACTIVE]}>
					Live Sandbox
				</button>
			</nav>
		</header>
	);
}
