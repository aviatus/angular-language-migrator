import * as fs from 'fs';
import { JSDOM } from 'jsdom';
import * as vscode from 'vscode';

import { TranslatesJSON } from './models';

const base = "000";
const bannedChars = ['<', '>', '{{', '}}'];
const punctiations = ['[', '.', ',', '-', '_', ';', '!', '^', '#', '+', '$', '%', '&', '*', ':', '!', '?', ']'];
const translates = new Map<string, Map<string, string>>();

export function createTranslationJSON() {
    let translateMap: TranslatesJSON = {};
    translates.forEach((value, key) => {
        translateMap = {
            ...translateMap,
            [key]: Object.fromEntries(value)
        };
    });

    return translateMap;
}

export function createTextMap(text: string[], fileName: string) {
    return [...new Map(text.map((t: string, index: number) => {
        const key = fileName + '_' + base.substring(0, base.length - index.toString().length) + index.toString();
        return [key, t];
    }))];
}

export function setTranslates(moduleName: string, moduleTranslates: Map<string, string>) {
    const currentTranslates = translates.get(moduleName);
    let keys: Map<string, string>;
    if (currentTranslates?.size) {
        keys = mergedMaps(currentTranslates, moduleTranslates);
    } else {
        keys = moduleTranslates;
    }

    translates.set(moduleName, keys);
}

export function scanDOMNodes(node: Node) {
    const texts = [];
    do {
        if (node?.textContent && node.nodeType !== 8) {
            const text = node?.textContent.replace(/\n/g, '');
            const isTextFitForTranslation = checkTextFromNodeFitForTranslation(text);

            if (isTextFitForTranslation) {
                const cleanedText = text.replace(/\s+/g, ' ');
                texts.push(cleanedText);
            }
        }

        node = node.firstChild as Node || node.nextSibling as Node || function () {
            while ((node = node.parentNode as Node) && !node.nextSibling);
            return node ? node.nextSibling : null;
        }();
    } while (node);

    return [...new Set(texts)];
}

export function replaceDOMNodes(dom: JSDOM, translateMap: [string, string][], moduleName: string): string {
    let node = dom.window.document as Node;
    do {
        if (node?.textContent) {
            const cleanText = node?.textContent.replace(/\n/g, '').replace(/\s+/g, ' ')
            const detectedTranslate = translateMap.find((translate) => translate[1] === cleanText);

            if (detectedTranslate) {
                const translateHTMLKey = `{{ '` + moduleName + '.' + detectedTranslate[0] + `' | translate }}`;
                node.textContent = translateHTMLKey;
            }
        }

        node = node.firstChild as Node || node.nextSibling as Node || function () {
            while ((node = node.parentNode as Node) && !node.nextSibling);
            return node ? node.nextSibling : null;
        }();
    } while (node);

    return dom.window.document.body?.innerHTML;
}

export function getUppercase(text: string): string {
    return text.split('.')[0].toUpperCase().replace(/-/g, '_');
}

export function getModuleName(filePath: string) {
    const moduleIndex = filePath.split('\\').findIndex(item => item === 'app');
    return moduleIndex > 0 ? getUppercase(filePath.split('\\')[moduleIndex + 1]) : '';
}

export function removeParentNodeTranslateDuplications(texts: string[]) {
    return texts.filter((translate: string, i: number) => !texts.some((t: string, j: number) => i < j && translate.includes(t)));
}

export function replaceHtmlTexts(textMap: [string, string][], dom: JSDOM, filePath: string, moduleName: string): Promise<void> {
    const replacedFile = replaceDOMNodes(dom, textMap, moduleName);

    return new Promise((resolve) => {
        if (!replacedFile) {
            throwReplacementError(filePath);
            resolve();
        } else {
            fs.writeFile(filePath, replacedFile, 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error(writeErr);
                }
                resolve();
            });
        }
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

function checkTextFromNodeFitForTranslation(text: string): boolean {
    const trimmedText = text.trim();
    const isNotPunctiation = punctiations.every((p) => trimmedText !== p);
    const isNotContainBannedChars = bannedChars.every(char => !text.includes(char));
    const isNotNumber = isNaN(+text);

    return trimmedText.length > 0 && isNotPunctiation && isNotContainBannedChars && isNotNumber;
}

function throwReplacementError(path: string) {
    const error = 'ERR:1001: Replacement error: ' + path;
    console.error(error);
    vscode.window.showInformationMessage(error);
}