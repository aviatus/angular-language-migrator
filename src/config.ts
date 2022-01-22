import * as vscode from 'vscode';

import { IOptions } from './models';

export const options: IOptions = {
    replaceHtmlTexts: true
};

export function loadConfigs() {
    const config = vscode.workspace.getConfiguration('angular-language-migrator');
    options.replaceHtmlTexts = !!config.get('replaceHtmlTexts');
}