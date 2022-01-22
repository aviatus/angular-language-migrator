import * as fs from 'fs';

import { TranslatesJSON } from './models';

const base = "0000";
const tags = ['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'td', 'label'];
const bannedChars = ['>', '<', '{{', '}}'];
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

export function getTagRegex(tag: string): RegExp {
    // eslint-disable-next-line no-useless-escape
    return new RegExp(`<${tag}.*>(.*?)<\/${tag}>`, 'g');
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

export function trimHtml(text: string): string[] {
    const nTags: Array<RegExpMatchArray | null> = tags.map((tag) => text.match(getTagRegex(tag)));
    // eslint-disable-next-line prefer-spread
    let merged: string[] = [].concat.apply([], nTags as []).filter(a => a);
    if (merged) {
        merged = merged.map(t => t.replace(/<\/?[^>]+(>|$)/g, "")).filter(t => t);
    }

    return merged.filter(t => bannedChars.every((char) => !t.includes(char)) && !punctiations.some((char) => t === char));
}