import * as yargs from "yargs";
import * as lsp from "vscode-languageserver/node";
import { runServer } from "./server";

type ArgsBase = { stdio?: true; nodeIpc?: true; socket?: number; pipe?: string; }
type StdIOArgs = { stdio: true; }
type NodeIPCArgs = { nodeIpc: true; }
type SocketArgs = { socket: number; }
type PipeArgs = { pipe: string; }

type Args = (StdIOArgs | NodeIPCArgs | SocketArgs | PipeArgs) & ArgsBase;

// The cli is defined like this because VSCode uses this parameters on its servers
const argv = yargs
	.version(require('../package.json').version)
	.options({
		"stdio": {
			type: "boolean",
			description: "Use stdio",
			require: false,
		},
		"node-ipc": {
			type: "boolean",
			description: "Use node-ipc",
			require: false,
		},
		"socket": {
			type: "number",
			description: "Use socket",
			require: false,
		},
		"pipe": {
			type: "string",
			description: "Use pipe",
			require: false,
		}
	})
	.help()
	.argv as any as Args;

const setArgs = [argv.stdio, argv.socket, argv.nodeIpc, argv.pipe];

if (setArgs.every(a => !a)) {
	console.error("Connection type required (stdio, node-ipc, socket, pipe). Refer to --help for more details.");
	process.exit(1);
}

if (setArgs.filter(a => !!a).length !== 1) {
	console.error("You can only set exactly one connection type (stdio, node-ipc, socket, pipe). Refer to --help for more details.");
	process.exit(1);
}

// We only use yargs for partial validation an providing help. the lsp.createConnection() handles the CLI params internally
const connection = lsp.createConnection();
runServer(connection);
