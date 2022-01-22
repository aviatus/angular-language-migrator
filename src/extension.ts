import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const { readdir } = fs.promises;

export interface IOptions {
	replaceHtmlTexts: boolean;
}

export type TranslatesJSON = { [key: string]: { [key: string]: string } };

let translates = new Map<string, Map<string, string>>();
let options: IOptions = {
	replaceHtmlTexts: true
};

const base = "0000";
const tags = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'td', 'label'];
const bannedChars = ['>', '<', '{{', '}}'];
const punctiations = ['[', '.', ',', '-', '_', ';', '!', '^', '#', '+', '$', '%', '&', '*', ':', '!', '?', ']'];

let customText = '';

export function activate(context: vscode.ExtensionContext) {
	console.log('Angular Language Migrator activated!');
	loadConfigs();

	const disposable = vscode.commands.registerCommand('angular-language-migrator.startMigration', async () => {
		const selectedPath = await vscode.window.showInputBox();
		vscode.window.showInformationMessage('HTML Scanning Started...');

		if (vscode.workspace.workspaceFolders !== undefined) {
			const currentlyWorkspacePath = selectedPath?.length ? selectedPath : vscode.workspace.workspaceFolders[0].uri.fsPath + '/src';
			const scannedFiles = scanFiles(currentlyWorkspacePath);

			Promise.resolve(scannedFiles).then((files: string | string[]) => {
				if (!Array.isArray(files)) {
					files = [files];
				}

				files.forEach(fileName => getTextsFromFile(fileName));
				console.log('Scanning Successfully Completed');
			});

			setTimeout(() => {
				let translateMap: TranslatesJSON = {};
				translates.forEach((value, key) => {
					translateMap = {
						...translateMap,
						[key]: Object.fromEntries(value)
					};
				});

				console.log('Language Migration File Creation Started...');
				fs.writeFile(currentlyWorkspacePath + "/language-migration-output.json", JSON.stringify(translateMap), () => {
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

function loadConfigs() {
	const config = vscode.workspace.getConfiguration('angular-language-migrator');
	options.replaceHtmlTexts = !!config.get('replaceHtmlTexts');
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
	let moduleName: string = '';
	let moduleTranslates = new Map<string, string>();

	const moduleIndex = filePath.split('\\').findIndex(item => item === 'app');
	moduleName = moduleIndex > 0 ? getUppercase(filePath.split('\\')[moduleIndex + 1]) : '';

	fs.readFile(filePath, 'utf-8', (_err, data) => {
		let text = trimHtml(data);
		if (text.length > 0) {
			const textMap = [...new Map(text.map((t: string, index: number) => {
				let key = fileName + '_' + base.substring(0, base.length - index.toString().length) + index.toString();
				return [key, t];
			}))];

			moduleTranslates = new Map([...moduleTranslates].concat(textMap));
			if (options.replaceHtmlTexts) {
				let results = '';
				text.forEach((item) => results = data.replace(item, '{{' + customText + getKey(textMap as any, item) + '| translate }}'));
				fs.writeFile(filePath, results, 'utf8', (err) => {
					if (err) {
						return console.error(err);
					}
				});
			}
		}

		const currentTranslates = translates.get(moduleName);
		let keys: Map<string, string>;
		if (currentTranslates?.size) {
			keys = mergedMaps(currentTranslates, moduleTranslates);
		} else {
			keys = moduleTranslates;
		}

		translates.set(moduleName, keys);
	});
}

function mergedMaps(...maps: Map<string, string>[]): Map<string, string> {
	const dataMap = new Map<string, string>([]);
	for (const map of maps) {
		for (const [key, value] of map) {
			dataMap.set(key, value);
		}
	}

	return dataMap;
}

function trimHtml(text: string): string[] {
	const nTags: Array<RegExpMatchArray | null> = tags.map((tag) => text.match(getTagRegex(tag)));
	let merged: Array<string> = [].concat.apply([], nTags as []).filter(a => a);
	if (merged) {
		merged = merged.map(t => t.replace(/<\/?[^>]+(>|$)/g, "")).filter(t => t);
	}

	return merged.filter(t => bannedChars.every((char) => !t.includes(char)) && !punctiations.some((char) => t === char));
}
