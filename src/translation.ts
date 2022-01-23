import * as fs from 'fs';

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

export function getKey(map: Map<string, string> | [string, string][], val: string): string {
    return [...map].find(([, value]) => val === value)?.[0] as string;
}

export function getUppercase(text: string): string {
    return text.split('.')[0].toUpperCase().replace(/-/g, '_');
}

export function getModuleName(filePath: string) {
    const moduleIndex = filePath.split('\\').findIndex(item => item === 'app');
    return moduleIndex > 0 ? getUppercase(filePath.split('\\')[moduleIndex + 1]) : '';
}

export function createTextMap(text: string[], fileName: string) {
    return [...new Map(text.map((t: string, index: number) => {
        const key = fileName + '_' + base.substring(0, base.length - index.toString().length) + index.toString();
        return [key, t];
    }))];
}

export function replaceHtmlTexts(text: string[], textMap: [string, string][], data: string, filePath: string, moduleName: string): Promise<void> {
    let results = '';
    text.forEach((item) => results = data.replace(item, `{{ '` + moduleName + '.' + getKey(textMap, item)
        + `' | translate }}`));

    return new Promise((resolve) => {
        fs.writeFile(filePath, results, 'utf8', (writeErr) => {
            if (writeErr) {
                console.error(writeErr);
            }
            resolve();
        });
    });
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

export function mergedMaps(...maps: Map<string, string>[]): Map<string, string> {
    const dataMap = new Map<string, string>([]);
    for (const map of maps) {
        for (const [key, value] of map) {
            dataMap.set(key, value);
        }
    }

    return dataMap;
}

export function removeParentNodeTranslateDuplications(texts: string[]) {
    return texts.filter((translate: string) => !texts.some((t: string) => t !== translate && translate.includes(t)));
}

export function travelDOMNodes(node: Node) {
    const texts = [];
    do {
        if (node?.textContent) {
            const text = node?.textContent.replace(/\n/g, '');
            const trimmedText = text.trim();
            const isTextFitForTranslation = trimmedText.length > 0 && punctiations.every((p) => trimmedText !== p) &&
                bannedChars.every(char => !text.includes(char)) && isNaN(+text);

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