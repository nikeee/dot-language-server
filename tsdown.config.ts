import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/cli.ts"],
	clean: true,
	exe: {
		outDir: "dist",
		fileName: "dot-language-server",
		targets: [
			{ platform: "linux", arch: "x64", nodeVersion: "latest" },
			{ platform: "darwin", arch: "arm64", nodeVersion: "latest" },
			// { platform: "win", arch: "x64", nodeVersion: "latest" },
		],
	},
});
