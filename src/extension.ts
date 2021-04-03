// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as child_process from "child_process";
import { ChildProcess, ExecException } from "node:child_process";
import { mapFilterUndefined } from "@glideapps/ts-necessities";

function leftJustify(snippet: string) {
	let matches = snippet.match(/^[\t ]*(?=.+)/gm);
	if (matches) {
		let minIndent = Math.min(...matches.map(match => match.length));
		return snippet.replace(new RegExp(`^[\\t ]{${minIndent}}`, "gm"), "");
	}
	return snippet;
}

function formatOutput(stdout: readonly any[], tag: string) {
	let out = Array();
	let definitionIndex;
	let link = "";
	let comment = "";
	let context = "";

	for (let i = 0; i < stdout.length; i++) {
		let line = stdout[i];
		if (line.type === "begin") {
			comment = "";
			context = "";
		} else if (line.type === "match") {
			if (comment) {
				out.push(link + leftJustify(comment) + leftJustify(context));
				context = "";
			}
			link = `file://${line.data.path.text}#${line.data.line_number}\n`;
			comment = line.data.lines.text;
			if (line.data.lines.text.match(new RegExp(`\\s+##${tag}:\\s+`, "g"))) {
				definitionIndex = out.length;
			}
		} else if (line.type === "context") {
			context += line.data.lines.text;
		} else if (line.type === "end") {
			out.push(link + leftJustify(comment) + leftJustify(context));
		}
	}

	//Place the definition first
	if (definitionIndex && out.length > 1) {
		let definition = out[definitionIndex];
		out[definitionIndex] = out[0];
		out[0] = definition;
	}

	return out.join("\n\n");
}

function rgCallback(error: ExecException | null, stdout: string, stderr: string) {
	if (error) {
		vscode.window.showErrorMessage(`${error}`);
	}
}

function rgPath(): string {
	let path: string | undefined = vscode.workspace.getConfiguration("tags").get("ripgrepPath");
	if (!path) {
		return "rg";
	}
	return path;
}

function rg(
	args: string,
	callback:
		| ((error: child_process.ExecException | null, stdout: string, stderr: string) => void)
		| undefined = rgCallback
): Promise<Array<any>> {
	// Run ripgrep
	let cmd = rgPath() + " ";
	let rg: ChildProcess = child_process.exec(cmd + args, callback);

	// Process rg's stdout
	let output = Array();
	rg.stdout?.on("data", data => {
		let lines = data.split("\n");
		let matches = lines.map((line: string) => {
			let json;
			try {
				json = JSON.parse(line);
			} catch (e) {
				//JSON parse error
				return null;
			}

			return json;
		});
		let filteredMatches = matches.filter((match: any) => match);
		if (filteredMatches.length > 0) {
			output = output.concat(filteredMatches);
		}
	});

	return new Promise((resolve, reject) => {
		rg.on("error", () => {
			reject(new Error("Could not spawn ripgrep"));
		});
		rg.stdout?.on("end", () => {
			resolve(output);
		});
	});
}

class TagsLinksProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.DocumentLink[] | undefined {
		let text = document.getText();
		let lines = text.split("\n");
		let tagsPattern: RegExp = /(?<=^\s*\/\/.*##)\w+(?=:*\b)/g;
		let matches = Array();

		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			while (true) {
				let match = tagsPattern.exec(line);
				if (match) {
					matches.push({ tag: match[0], line: i, index: match.index });
				} else {
					break;
				}
			}
		}

		let links = matches.map(match => {
			return new vscode.DocumentLink(
				new vscode.Range(match.line, match.index, match.line, match.index + match.tag.length),
				vscode.Uri.parse("tags:" + match.tag + ".tags")
			);
		});

		return links;
	}
}

class TagsProvider implements vscode.TextDocumentContentProvider {
	rootpath: string;

	constructor(rootpath: string) {
		this.rootpath = rootpath;
	}

	provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		let tag = uri.path.split(".")[0];
		let args: string =
			` --type-add 'typescript:*.ts'` +
			` --type-add 'typescript:*.tsx'` +
			` -ttypescript` +
			` --json` +
			` -U -A 2` +
			` -e '(.*//.*\\n)*(.*//.*\\s+##${tag}:*.*\\n)+(.*//.*\\n)*'` +
			` ${this.rootpath}`;

		return new Promise((resolve, reject) => {
			rg(args).then(output => {
				resolve(formatOutput(output, tag));
			});
		});
	}
}

function showAllTags(rootpath: string) {
	let args: string =
		` --type-add 'typescript:*.ts'` +
		` --type-add 'typescript:*.tsx'` +
		` -ttypescript` +
		` --json -U` +
		` -e '//.*\\s+##\\w+:.*\\n'` +
		` ${rootpath}`;

	rg(args).then(output => {
		let items: vscode.QuickPickItem[] = mapFilterUndefined(output, item => {
			if (item.type !== "match") return undefined;
			let path: string = item.data.path.text.replace(rootpath, "").replace(/^\//, "");
			let text: string = item.data.lines.text;
			let labelMatch = text.match(/(?<=\s+##)\w+(?=:\s+)/);
			if (labelMatch === null) return undefined;
			return { label: labelMatch[0], detail: `${path}#${item.data.line_number}` };
		});

		vscode.window.showQuickPick(items).then(async selected => {
			if (selected) {
				let doc = await vscode.workspace.openTextDocument(vscode.Uri.parse("tags:" + selected.label + ".tags"));
				await vscode.window.showTextDocument(doc, { preview: false });
			}
		});
	});
}

// This method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Check for ripgrep
	rg(`--help`, (error: ExecException | null, stdout: string, stderr: string) => {
		if (error) {
			vscode.window.showErrorMessage(`${error}: make sure ripgrep is installed and configure the correct path`);
		}
	});

	// Register document link
	let documentLinkRegistration = vscode.languages.registerDocumentLinkProvider(
		[{ language: "typescript" }, { language: "typescriptreact" }, { pattern: "*.tags" }],
		new TagsLinksProvider()
	);
	context.subscriptions.push(documentLinkRegistration);

	// Register uri provider
	// Get the rootpath
	let rootpath: string | undefined;
	let workSpace = vscode.workspace.workspaceFolders;
	if (workSpace) {
		rootpath = workSpace[0].uri.fsPath;
		let registrationDisposable = vscode.workspace.registerTextDocumentContentProvider(
			"tags",
			new TagsProvider(rootpath)
		);
		context.subscriptions.push(registrationDisposable);
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let commandDisposable = vscode.commands.registerCommand("tags.tags", async () => {
		// Get the rootpath if it is undefined
		// and register documentContentProvider
		if (rootpath === undefined) {
			rootpath = await vscode.window.showInputBox({ prompt: "directory to search in" });
			if (rootpath) {
				let registrationDisposable = vscode.workspace.registerTextDocumentContentProvider(
					"tags",
					new TagsProvider(rootpath)
				);
				context.subscriptions.push(registrationDisposable);
			}
		}

		if (rootpath) {
			showAllTags(rootpath);
		}
	});

	context.subscriptions.push(commandDisposable);
}
