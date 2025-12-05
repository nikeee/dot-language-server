#!/usr/bin/env node

// Caution: This file was vibe-coded. It is only used to ensure that upgrading the LSP librarys doesnt break anything

import { spawn } from "node:child_process";
import { join } from "node:path";
import { test, after, describe } from "node:test";
import { strict as assert } from "node:assert";

interface LSPMessage {
	jsonrpc: "2.0";
	id?: number | string;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

class LSPSmokeTest {
	private serverProcess;
	private messageId = 0;
	private pendingRequests = new Map<
		number | string,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timeout: NodeJS.Timeout;
		}
	>();
	private buffer = "";

	constructor(serverPath: string) {
		this.serverProcess = spawn(serverPath, ["--stdio"], {
			cwd: process.cwd(),
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.serverProcess.stderr?.on("data", (data: Buffer) => {
			console.error(`[Server stderr] ${data.toString()}`);
		});

		this.serverProcess.stdout?.on("data", (data: Buffer) => {
			this.handleServerOutput(data);
		});

		this.serverProcess.on("error", error => {
			console.error(`Failed to start server: ${error.message}`);
		});

		this.serverProcess.on("exit", (code, signal) => {
			if (code !== null && code !== 0) {
				console.error(`Server exited with code ${code}`);
			}
			if (signal) {
				console.error(`Server was killed with signal ${signal}`);
			}
		});
	}

	private handleServerOutput(data: Buffer): void {
		this.buffer += data.toString();

		// LSP messages use format: "Content-Length: <n>\r\n\r\n<json>"
		while (this.buffer.length > 0) {
			const headerMatch = this.buffer.match(/Content-Length: (\d+)\r?\n\r?\n/);
			if (!headerMatch) {
				// Don't have a complete header yet
				break;
			}

			const contentLength = parseInt(headerMatch[1], 10);
			const headerEnd = headerMatch[0].length;
			const messageStart = headerEnd;
			const messageEnd = messageStart + contentLength;

			if (this.buffer.length < messageEnd) {
				// Don't have the complete message yet
				break;
			}

			const jsonStr = this.buffer.substring(messageStart, messageEnd);
			this.buffer = this.buffer.substring(messageEnd);

			try {
				const message: LSPMessage = JSON.parse(jsonStr);
				this.handleMessage(message);
			} catch (error) {
				console.error(
					`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
				);
				console.error(`Message: ${jsonStr}`);
			}
		}
	}

	private handleMessage(message: LSPMessage): void {
		if (message.id !== undefined && this.pendingRequests.has(message.id)) {
			const pending = this.pendingRequests.get(message.id)!;
			clearTimeout(pending.timeout);

			if (message.error) {
				pending.reject(
					new Error(
						`Server error: ${message.error.message} (code: ${message.error.code})`,
					),
				);
			} else {
				pending.resolve(message.result);
			}

			this.pendingRequests.delete(message.id);
		}
	}

	private sendMessage(message: Omit<LSPMessage, "jsonrpc">): Promise<unknown> {
		const id = ++this.messageId;
		const fullMessage: LSPMessage = {
			jsonrpc: "2.0",
			id,
			...message,
		};

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Request ${id} (${message.method}) timed out after 5 seconds`));
			}, 5000);

			this.pendingRequests.set(id, { resolve, reject, timeout });

			const jsonStr = JSON.stringify(fullMessage);
			const contentLength = Buffer.byteLength(jsonStr, "utf8");
			const messageStr = `Content-Length: ${contentLength}\r\n\r\n${jsonStr}`;

			this.serverProcess.stdin?.write(messageStr, "utf8", error => {
				if (error) {
					clearTimeout(timeout);
					this.pendingRequests.delete(id);
					reject(error);
				}
			});
		});
	}

	async testInitialize(): Promise<{ capabilities?: unknown }> {
		const result = (await this.sendMessage({
			method: "initialize",
			params: {
				processId: process.pid,
				clientInfo: {
					name: "smoketest",
					version: "1.0.0",
				},
				locale: "en",
				rootPath: null,
				rootUri: null,
				capabilities: {},
				workspaceFolders: null,
			},
		})) as { capabilities?: unknown };

		return result;
	}

	async testInitialized(): Promise<void> {
		// This is a notification, so no response expected
		// Send it directly without waiting for a response
		const notification: LSPMessage = {
			jsonrpc: "2.0",
			method: "initialized",
		};
		const jsonStr = JSON.stringify(notification);
		const contentLength = Buffer.byteLength(jsonStr, "utf8");
		const messageStr = `Content-Length: ${contentLength}\r\n\r\n${jsonStr}`;

		this.serverProcess.stdin?.write(messageStr, "utf8");
	}

	async shutdown(): Promise<void> {
		try {
			await this.sendMessage({
				method: "shutdown",
			});
			// Send exit notification
			const exitMessage: LSPMessage = {
				jsonrpc: "2.0",
				method: "exit",
			};
			const jsonStr = JSON.stringify(exitMessage);
			const contentLength = Buffer.byteLength(jsonStr, "utf8");
			const messageStr = `Content-Length: ${contentLength}\r\n\r\n${jsonStr}`;
			this.serverProcess.stdin?.write(messageStr, "utf8");

			// Give the server a moment to exit gracefully
			await new Promise(resolve => setTimeout(resolve, 500));

			if (!this.serverProcess.killed && this.serverProcess.exitCode === null) {
				this.serverProcess.kill();
			}
		} catch (error) {
			this.serverProcess.kill();
			throw error;
		}
	}
}

const serverPath = join(process.cwd(), "dist", "linux-x64", "dot-language-server");
let lspTest: LSPSmokeTest;

describe("LSP smoketest", () => {
	test("server starts", async () => {
		lspTest = new LSPSmokeTest(serverPath);
		// Wait a bit for the server to start
		await new Promise(resolve => setTimeout(resolve, 500));
	});

	test("initialize request", async () => {
		const result = await lspTest.testInitialize();

		assert.ok(result, "Initialize should return a result");
		assert.ok(typeof result === "object", "Result should be an object");
		assert.ok("capabilities" in result, "Result should have capabilities");
	});

	test("initialized notification", async () => {
		await lspTest.testInitialized();
		// Notification doesn't return a response, so we just verify it doesn't throw
	});

	test("shutdown", async () => {
		await lspTest.shutdown();
	});

	after(async () => {
		if (lspTest) {
			try {
				await lspTest.shutdown();
			} catch {
				// Ignore errors during cleanup
			}
		}
	});
});
