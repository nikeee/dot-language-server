"use strict";
import * as lsp from "vscode-languageserver";
import * as rpc from "vscode-jsonrpc";
import { createService, SourceFile } from "dot-language-support";
import { DotLanguageServerSettings, Settings } from "./types";
import { Command } from "vscode-languageserver";

const defaultSettings: DotLanguageServerSettings = { maxNumberOfProblems: 100 };

export function runServer(connection: lsp.IConnection) {
	if (!connection)
		throw "connection is missing";

	const languageService = createService();

	// Create a simple text document manager.
	// The text document manager supports full document sync only
	let documents = new lsp.TextDocuments();
	const astOfFile = new Map<string, SourceFile>();

	// Make the documents listen for changes on the connection
	documents.listen(connection);

	let shouldSendDiagnosticRelatedInformation: boolean = false;

	// After the server has started the client sends an initialize request. The server receives
	// in the passed params the rootPath of the workspace plus the client capabilities.
	connection.onInitialize((_params): lsp.InitializeResult => {
		let a = _params.capabilities && _params.capabilities.textDocument && _params.capabilities.textDocument.publishDiagnostics && _params.capabilities.textDocument.publishDiagnostics.relatedInformation;
		shouldSendDiagnosticRelatedInformation = !!a;

		return {
			capabilities: {
				textDocumentSync: documents.syncKind, // Only sync the entire document
				completionProvider: {
					triggerCharacters: ["="],
					resolveProvider: false, // TODO: Maybe support this
				},
				hoverProvider: true,
				referencesProvider: true,
				definitionProvider: true,
				renameProvider: true,
				codeActionProvider: true,
				executeCommandProvider: {
					 commands: languageService.getAvailableCommands(),
				},
				// colorProvider: true,
				// documentFormattingProvider: true,
			}
		}
	});

	function rebuildAll() {
		for (const uri of astOfFile.keys())
			updateAst(uri);
	}

	function updateAst(uri: string, doc?: lsp.TextDocument): SourceFile | undefined {
		if (doc === undefined)
			doc = documents.get(uri);

		if (doc) {
			const ast = languageService.parseDocument(doc)
			astOfFile.set(uri, ast);
			return ast;
		}
		return undefined;
	}

	function ensureAst(uri: string, doc?: lsp.TextDocument): SourceFile | undefined {
		let ast = astOfFile.get(uri);
		if (ast === undefined)
			ast = updateAst(uri, doc);
		return ast;
	}

	connection.onHover(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		return doc && ast
			? languageService.hover(doc, ast, req.position)
			: invalidRequest();
	});

	connection.onReferences(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		return doc && ast
			? languageService.findReferences(doc, ast, req.position, req.context)
			: invalidRequest();
	});

	connection.onDefinition(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		return doc && ast
			? languageService.findDefinition(doc, ast, req.position)
			: invalidRequest();
	});

	/*
	connection.onDocumentColor(req => {
		return [
			{
				range: { start: { line: 1, character: 0 }, end: { line: 1, character: 7 }, },
				color: { red: 1.0, alpha: 1.0, green: 0.0, blue: 0.0 },
			}
		];
	});

	connection.onColorPresentation(req => {
		return [
			{
				label: req.color.toString(),
			}
		];
	});
	*/

	/**
	 * Event that gathers possible code actions
	 */
	connection.onCodeAction(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		if (doc && ast) {
			const r = languageService.getCodeActions(doc, ast, req.range, req.context);

			// Put the URI of the current document to the end
			// We need the uri to get the AST later
			if (r) {
				r.forEach(command => {
					if (command.arguments)
						command.arguments.push(uri);
					else
						command.arguments = [uri];
				});
			}

			return r;
		}
		return invalidRequest();
	});

	/**
	 * Gets called when a code action is actually invoked.
	 */
	connection.onExecuteCommand(req => {
		const args = req.arguments;
		if (!args || args.length < 1)
			return;

		// Remove the URI and retrieve AST
		const uri = args.pop();
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		if (doc && ast) {
			req.arguments = args.length === 0 ? undefined : args;
			const edit = languageService.executeCommand(doc, ast, req);

			if (edit)
				connection.workspace.applyEdit(edit);
		}
	});

	/**
	 * Invoked when user renames something.
	 * TODO: Symbol Provider, so we can only rename symbols?
	 */
	connection.onRenameRequest(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		if (doc && ast) {
			const r = languageService.renameSymbol(doc, ast, req.position, req.newName);
			return r ? r : invalidRequest();
		}
		return invalidRequest();
	});

	/**
	 * Update the current AST and send diagnostics.
	 */
	documents.onDidChangeContent(change => {
		const doc = change.document;
		const ast = updateAst(doc.uri, doc);
		if (ast === undefined) throw "This cannot happen";
		return validateDocument(doc, ast);
	});

	let currentSettings: DotLanguageServerSettings = { ...defaultSettings };

	// The settings have changed. Is send on server activation as well.
	connection.onDidChangeConfiguration(change => {
		const newSettings = (change.settings as Settings).dotLanguageServer;
		if (newSettings)
			currentSettings = newSettings;

		rebuildAll();
		validateAll();
	});

	function validateAll() {
		for (const uri of astOfFile.keys()) {
			const doc = documents.get(uri);
			if (doc) {
				const ast = ensureAst(uri, doc);
				if (ast)
					validateDocument(doc, ast);
			}
		}
	}
	function validateDocument(doc: lsp.TextDocument, sf: SourceFile): void {
		const diagnostics = languageService.validateDocument(doc, sf);
		connection.sendDiagnostics({ uri: doc.uri, diagnostics });
	}

	connection.onDidChangeWatchedFiles(_change => {
		// Monitored files have change in VSCode
		connection.console.log("We received an file change event");
	});

	/**
	 * Invoked when the user types and the editor requests a list of items to display for completion.
	 */
	connection.onCompletion(req => {
		const uri = req.textDocument.uri;
		const doc = documents.get(uri);
		const ast = ensureAst(uri, doc);
		return doc && ast
			? languageService.getCompletions(doc, ast, req.position)
			: invalidRequest();
	});

	/**
	 * Provide some details about the completion.
	 * TODO: Omit or implement.
	 */
	connection.onCompletionResolve((item: lsp.CompletionItem): lsp.CompletionItem => {
		if (item.data === 1) {
			item.detail = "TypeScript details";
			item.documentation = "TypeScript documentation";
		} else if (item.data === 2) {
			item.detail = "JavaScript details";
			item.documentation = "JavaScript documentation";
		}
		return item;
	});

	documents.onDidOpen(params => updateAst(params.document.uri, params.document));

	const cancelled = () => new rpc.ResponseError<void>(rpc.ErrorCodes.RequestCancelled, "Request cancelled");
	const invalidRequest = () => new rpc.ResponseError<void>(rpc.ErrorCodes.InvalidRequest, "Invalid request");

	connection.listen();
}

