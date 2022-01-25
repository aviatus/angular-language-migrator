import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import * as path from 'path';
import * as vscode from 'vscode';

import { options } from './config';
import { TranslatesJSON } from './models';
import * as Translation from './translation';

const { readdir } = fs.promises;

export const writePromises: Promise<boolean>[] = [];

export function createTranslateFile(currentlyWorkspacePath: string) {
    const translateMap = Translation.createTranslationJSON();
    const translateFile = createFile(currentlyWorkspacePath, translateMap);

    translateFile.then(() => {
        vscode.window.showInformationMessage('Translation file has been created.');
    });
}

export function createFile(currentlyWorkspacePath: string, translateMap: TranslatesJSON): Promise<void> {
    return new Promise((resolve) => {
        fs.writeFile(currentlyWorkspacePath + "/translation.json", JSON.stringify(translateMap), (err) => {
            if (err) {
                console.error(err);
            }
            resolve();
        });
    });
}

export function getTextsFromFile(filePath: string): Promise<void> {
    const fileName = Translation.getUppercase(path.parse(filePath).base);
    const moduleName = Translation.getModuleName(filePath);
    let moduleTranslates = new Map<string, string>();

    return new Promise((resolve) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                console.error(err);
            } else {
                const dom = new JSDOM('<!DOCTYPE html>' + data);
                let translates = Translation.scanDOMNodes(dom.window.document);
                translates = Translation.removeParentNodeTranslateDuplications(translates);

                if (translates.length > 0) {
                    const translateMap = Translation.createTextMap(translates, fileName);
                    moduleTranslates = new Map([...moduleTranslates].concat(translateMap));

                    if (options.replaceHtmlTexts) {
                        writePromises.push(Translation.replaceHtmlTexts(translateMap, dom, filePath, moduleName));
                    }
                }

                Translation.setTranslates(moduleName, moduleTranslates);
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

        const filePromises: Promise<void>[] = files.map(fileName => getTextsFromFile(fileName));
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