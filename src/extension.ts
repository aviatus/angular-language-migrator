import * as vscode from 'vscode';

import * as Config from './config';
import * as File from './file';

export function activate(context: vscode.ExtensionContext) {
	Config.loadConfigs();

	const disposable = vscode.commands.registerCommand('angular-language-migrator.startMigration', async () => {
		const selectedPath = await vscode.window.showInputBox();
		vscode.window.showInformationMessage('Project scan started...');

		if (vscode.workspace.workspaceFolders !== undefined) {
			const currentlyWorkspacePath = selectedPath?.length ? selectedPath : vscode.workspace.workspaceFolders[0].uri.fsPath + '/src/app';
			const scannedFiles = File.scanFiles(currentlyWorkspacePath);
			const readFiles = File.readScannedFiles(scannedFiles);

			readFiles.then((files) => {
				vscode.window.showInformationMessage(files.length + ' files are successfully scanned.');
				if (File.writePromises.length > 0) {
					Promise.all(File.writePromises).then((status) => {
						const errorCount = status.filter((s) => !s).length;
						vscode.window.showInformationMessage(status.length + ' files successfull updated. ' + errorCount + ' files could not be updated.');
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