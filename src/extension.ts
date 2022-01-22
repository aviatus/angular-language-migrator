import * as vscode from 'vscode';

import * as Config from './config';
import * as File from './file';

export function activate(context: vscode.ExtensionContext) {
	Config.loadConfigs();

	const disposable = vscode.commands.registerCommand('angular-language-migrator.startMigration', async () => {
		const selectedPath = await vscode.window.showInputBox();
		vscode.window.showInformationMessage('Language migration started...');

		if (vscode.workspace.workspaceFolders !== undefined) {
			const currentlyWorkspacePath = selectedPath?.length ? selectedPath : vscode.workspace.workspaceFolders[0].uri.fsPath + '/src';
			const scannedFiles = File.scanFiles(currentlyWorkspacePath);
			const readFiles = File.readScannedFiles(scannedFiles);

			readFiles.then(() => {
				vscode.window.showInformationMessage('Scanning successfully completed.');

				if (File.writePromises.length > 0) {
					Promise.all(File.writePromises).then(() => {
						vscode.window.showInformationMessage('Language HTML change completed.');
						File.createTranslateFile(currentlyWorkspacePath);
					});
				} else {
					File.createTranslateFile(currentlyWorkspacePath);
				}
			});
		} else {
			const message = "Angular Language Migrator: Working folder not found, open a folder an try again";
			vscode.window.showErrorMessage(message);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	vscode.window.showInformationMessage('Angular language migrator deactivated!');
}