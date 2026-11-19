import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => ({
	oxc: {
		jsx: {
			runtime: "automatic",
			importSource: "@solidjs/web",
		},
	},
	staged: {
		"*": ["vp check --fix --no-error-on-unmatched-pattern"],
	},
	fmt: {
		useTabs: true,
		singleQuote: false,
		trailingComma: "all",
		printWidth: 220,
		tabWidth: 4,
		semi: true,
		bracketSameLine: true,
		htmlWhitespaceSensitivity: "ignore",
		sortPackageJson: false,
	},
	plugins: [
		solid({
			start: true,
			extensions: [".jsx", ".tsx"],
			refresh: process.env.DISABLE_HMR !== "true",
		}),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	server: {
		allowedHosts: true,
		hmr: process.env.DISABLE_HMR !== "true",
		watch: process.env.DISABLE_HMR === "true" ? null : {},
	},
}));
