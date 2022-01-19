import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const { readdir } = fs.promises;

export interface MigrationOptions {
	moduleNaming: boolean;
	changeHtml: boolean;
}

let texts = new Map();
let options: MigrationOptions = {
	moduleNaming: true,
	changeHtml: true
};

const base = "0000";
const tags = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'];
const bannedChars = ['>', '<', '{{', '}}'];
let customText = '';

export function activate(context: vscode.ExtensionContext) {
	console.log('Angular Language Migrator activated!');

	let disposable = vscode.commands.registerCommand('angular-language-migrator.startMigration', () => {
		vscode.window.showInformationMessage('HTML Scanning Started...');

		if (vscode.workspace.workspaceFolders !== undefined) {
			const currentlyOpenTabfilePath = vscode.workspace.workspaceFolders[0].uri.fsPath + '/src';
			const scannedFiles = scanFiles(currentlyOpenTabfilePath);

			Promise.resolve(scannedFiles).then((files: string | string[]) => {
				if (!Array.isArray(files)) {
					files = [files];
				}

				files.forEach(fileName => getTextsFromFile(fileName));
				console.log('Scanning Successfully Completed');
			});

			setTimeout(() => {
				console.log('Language Migration File Creation Started...');
				fs.writeFile(currentlyOpenTabfilePath + "/language-migration-output.json", JSON.stringify(Object.fromEntries(texts)), () => {
					console.log('Language Migration File Creation Completed....');
					vscode.window.showInformationMessage('Language Migration Completed.');
				});
			}, 1000);
		} else {
			const message = "Angular Language Migrator: Working folder not found, open a folder an try again";
			vscode.window.showErrorMessage(message);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	console.log('Angular Language Migrator deactivated!');
}

function getTagRegex(tag: string): RegExp {
	return new RegExp(`<${tag}.*>(.*?)<\/${tag}>`, 'g');
}

function getKey(map: Map<string, string>, val: string): string {
	return [...map].find(([, value]) => val === value)?.[0] as string;
}

function getUppercase(text: string): string {
	return text.split('.')[0].toUpperCase().replace(/-/g, '_');
}

async function scanFiles(dir: string): Promise<string | string[]> {
	const dirents = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(dirents.filter(dirent => dirent.name.endsWith('.html') || dirent.isDirectory()).map((dirent) => {
		const res = path.resolve(dir, dirent.name);
		return dirent.isDirectory() ? scanFiles(res) : res;
	}));

	return Array.prototype.concat(...files);
}

async function getTextsFromFile(filePath: string) {
	const fileName = getUppercase(path.parse(filePath).base);
	let moduleName = '';

	if (options.moduleNaming) {
		const index = filePath.split('\\').findIndex(item => item === 'app');
		moduleName = index > 0 ? getUppercase(filePath.split('\\')[index + 1]) + '_' : '';
	}

	fs.readFile(filePath, 'utf-8', (_err, data) => {
		let text = trimHtml(data);
		if (text.length > 0) {
			const textMap = [...new Map(text.map((t: string, index: number) => {
				let key = moduleName + fileName + '_' + base.substring(0, base.length - index.toString().length) + index.toString();
				return [key, t];
			}))];
			texts = new Map([...texts].concat(textMap));

			if (options.changeHtml) {
				let results = '';
				text.forEach((item) => results = data.replace(item, '{{' + customText + getKey(textMap as any, item) + '}}'));
				fs.writeFile(filePath, results, 'utf8', (err) => {
					if (err) {
						return console.error(err);
					}
				});
			}
		}
	});
}

function trimHtml(text: string) {
	const nTags: Array<RegExpMatchArray | null> = tags.map((tag) => text.match(getTagRegex(tag)));
	let merged: Array<string> = [].concat.apply([], nTags as []).filter(a => a);
	if (merged) {
		merged = merged.map(t => t.replace(/<\/?[^>]+(>|$)/g, "")).filter(t => t);
	}

	return merged.filter(t => bannedChars.every((char) => !t.includes(char)));
}
