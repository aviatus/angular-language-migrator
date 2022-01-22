import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { TranslatesJSON } from './models';
import * as Translation from './translation';

const { readdir } = fs.promises;

// eslint-disable-next-line prefer-const
export let writePromises: Promise<void>[] = [];

export function createTranslateFile(currentlyWorkspacePath: string) {
    const translateMap = Translation.createTranslationJSON();
    const translateFile = createFile(currentlyWorkspacePath, translateMap);

    translateFile.then(() => {
        vscode.window.showInformationMessage('Language migration completed.');
    });
}

export function createFile(currentlyWorkspacePath: string, translateMap: TranslatesJSON): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(currentlyWorkspacePath + "/language-migration-output.json", JSON.stringify(translateMap), (err) => {
            if (err) {
                console.error(err);
            }
            resolve();
        });
    });
}

export function readScannedFiles(scannedFiles: Promise<string | string[]>): Promise<void[]> {
    return Promise.resolve(scannedFiles).then((files: string | string[]) => {
        if (!Array.isArray(files)) {
            files = [files];
        }

        const filePromises: Promise<void>[] = files.map(fileName => Translation.getTextsFromFile(fileName));
        return Promise.all(filePromises);
    });
}

export async function scanFiles(dir: string): Promise<string | string[]> {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.filter(dirent => dirent.name.endsWith('.html') || dirent.isDirectory()).map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? scanFiles(res) : res;
    }));

    return Array.prototype.concat(...files);
}