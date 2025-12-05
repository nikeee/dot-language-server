import { parseArgs } from "node:util";

import * as lsp from "vscode-languageserver/node";
import { runServer } from "./server";

type ArgsBase = { stdio?: true; nodeIpc?: true; socket?: number; pipe?: string };
type StdIOArgs = { stdio: true };
type NodeIPCArgs = { nodeIpc: true };
type SocketArgs = { socket: number };
type PipeArgs = { pipe: string };

type Args = (StdIOArgs | NodeIPCArgs | SocketArgs | PipeArgs) & ArgsBase;

// The cli is defined like this because VSCode uses this parameters on its servers
const { values } = parseArgs({
	options: {
		stdio: {
			type: "boolean",
		},
		"node-ipc": {
			type: "boolean",
		},
		socket: {
			type: "string",
		},
		pipe: {
			type: "string",
		},
		version: {
			type: "boolean",
			short: "v",
		},
		help: {
			type: "boolean",
			short: "h",
		},
	},
	strict: false,
	allowPositionals: true,
});

if (values.version) {
	console.log(require("../package.json").version);
	process.exit(0);
}

if (values.help) {
	console.log(`
Options:
  --stdio              Use stdio
  --node-ipc           Use node-ipc
  --socket <number>    Use socket
  --pipe <string>      Use pipe
  -v, --version        Show version number
  -h, --help           Show help
`);
	process.exit(0);
}

const argv = {
	stdio: values.stdio ? true : undefined,
	nodeIpc: values["node-ipc"] ? true : undefined,
	socket: values.socket ? Number(values.socket) : undefined,
	pipe: values.pipe ? String(values.pipe) : undefined,
} as unknown as Args;

const setArgs = [argv.stdio, argv.socket, argv.nodeIpc, argv.pipe];

if (setArgs.every(a => !a)) {
	console.error(
		"Connection type required (stdio, node-ipc, socket, pipe). Refer to --help for more details.",
	);
	process.exit(1);
}

if (setArgs.filter(a => !!a).length !== 1) {
	console.error(
		"You can only set exactly one connection type (stdio, node-ipc, socket, pipe). Refer to --help for more details.",
	);
	process.exit(1);
}

// We only use parseArgs for partial validation and providing help. the lsp.createConnection() handles the CLI params internally
const connection = lsp.createConnection();
runServer(connection);
