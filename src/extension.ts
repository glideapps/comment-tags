// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { ChildProcess } from 'node:child_process';


function formatOutput(stdout) {
	let out = Array();
	let section = "";

	for (let i = 0; i < stdout.length; i++) {
		let line = stdout[i];
		if (line.type === "begin") {
			section = "";
		} else if (line.type === "match") {
			section += `file://${line.data.path.text}#${line.data.line_number}\n`;
			section += line.data.lines.text;
		} else if (line.type === "context") {
			section += line.data.lines.text;
		} else if (line.type === "end") {
			out.push(section);
		}

	}

	return out.join("\n\n");
}

// This method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('tags.tags', async () => {
		// Get tag as active word on editor
		let tag: string | undefined;
		let editor = vscode.window.activeTextEditor;
		if (editor === undefined || editor.selection.isEmpty) {
			tag = await vscode.window.showInputBox({ prompt: "tag to search for" });;
		} else {
			tag = editor.document.getText(editor.selection);
		}

		if (tag === undefined) {
			return;
		}

		// Get the rootpath
		let rootpath: string | undefined;
		let workSpace = vscode.workspace.workspaceFolders;
		if (workSpace === undefined) {
			rootpath = await vscode.window.showInputBox({ prompt: "directory to search in" });
		} else {
			rootpath = workSpace[0].uri.fsPath;
		}
		if (rootpath === undefined) { return; };

		// Run ripgrep
		let cmd: string = `rg` +
			` --type-add 'typescript:*.ts'` +
			` --type-add 'typescript:*.tsx'` +
			` -ttypescript` +
			` --json` +
			` -U -A 2` +
			` -e '(.*//.*\\n)*(.*//.*\\s+##${tag}\\s+.*\\n)+(.*//.*\\n)*'` +
			` ${rootpath}`;
		console.log(`cmd: ${cmd}`);
		let rg: ChildProcess = child_process.exec(cmd);

		// Process rg's stdout
		let output = Array();
		rg.stdout?.on('data', (data) => {
			let lines = data.split('\n');
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
			};
		});


		// Show text document from string
		rg.stdout?.on('end', () => {
			vscode.workspace.openTextDocument(
				//vscode.Uri.parse(`tags://${tag}`)
				{ content: formatOutput(output), language: 'typescript' }
			).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		});

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }