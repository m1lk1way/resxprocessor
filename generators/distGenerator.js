const fs = require('fs');
const { promisify } = require('util');
const jsStringEscape = require('js-string-escape');
const LogUtility = require('../utils/logUtility');
const PathUtility = require('../utils/pathUtility');
const MarkupUtility = require('../utils/markupUtility');
const fsOptions = require('../utils/fsOptions');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const pathUtility = new PathUtility();
const markup = new MarkupUtility();

class DistGenerator {
    constructor(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS, tsGlobInterface) {
        this.jsNamespace = jsNamespace;
        this.languages = languages;
        this.defaultLang = defaultLang;
        this.resxPrefix = resxPrefix;
        this.srcFolder = srcFolder;
        this.currentLangNS = currentLangNS;
        this.tsGlobInterface = tsGlobInterface;
    }

    static genResxStrs(json) {
        const keys = Object.keys(json).sort();
        return keys.map(k => `${markup.tab}${k}: '${jsStringEscape(json[k])}',`);
    }

    static genResxObj(content, name) {
        return `export const ${name} = {${content ? markup.newLine + content + markup.newLine : ''}};`;
    }

    genNameSpaceAssign() {
        return `${this.jsNamespace} = ${this.jsNamespace} || {};${markup.newLine}`;
    }

    genLangsMapObj(chunk) {
        const mapObjBody = this.languages.map(l => `${markup.tab}${l}: ${chunk}${l},`).join(markup.newLine);
        const langsMapObj = `const langMap: {[k: string]: any} = {${markup.newLine}${mapObjBody}${markup.newLine}};`;
        return langsMapObj;
    }

    genAssignToNameSpace(chunkName, wrapperChunkName) {
        return `${this.jsNamespace}.${chunkName} = ${wrapperChunkName || chunkName};`;
    }

    static genResxDistBody(name, langData) {
        const keyValPairsToGenerate = Object.keys(langData)
            .filter(k => langData[k] !== null)
            .reduce((acc, k) => {
                acc[k] = langData[k];
                return acc;
            }, {});

        const strings = DistGenerator.genResxStrs(keyValPairsToGenerate);

        return [
            markup.autoGenStr,
            markup.newLine,
            DistGenerator.genResxObj(strings.join(markup.newLine), name),
        ].join('');
    }

    static processJsonToJs(body, filePath) {
        return writeFileAsync(filePath, body + markup.newLine, fsOptions.write);
    }

    static getSortedSrcKeys(fileData) {
        return Object.keys(JSON.parse(fileData)).sort();
    }

    static genResxGetterStrs(keys, defaultLang, currentLangNS) {
        const strings = keys.map(k => (
            `${markup.tab}get ${k}() {${markup.newLine}${markup.tab}${markup.tab}return `
            + `langMap[${currentLangNS}].${k} || langMap.${defaultLang}.${k};${markup.newLine}${markup.tab}},`
        ));
        const ResxGetterStrs = strings.join(markup.newLine);
        return ResxGetterStrs;
    }

    genResxWrapperBody(fileData, chunkName) {
        const wrapperChunkName = chunkName + this.resxPrefix;
        const keys = DistGenerator.getSortedSrcKeys(fileData); // use sort from sortUtility here
        const imports = DistGenerator.generateNamedImports(chunkName, this.languages, this.resxPrefix);
        const langsMapObj = this.genLangsMapObj(chunkName);
        const content = DistGenerator.genResxGetterStrs(keys, this.defaultLang, this.currentLangNS);
        const resxObj = DistGenerator.genResxObj(content, wrapperChunkName);
        const nameSpaceAssign = this.genAssignToNameSpace(chunkName, wrapperChunkName);

        const body = [
            markup.autoGenStr,
            imports,
            markup.newLine,
            markup.newLine,
            langsMapObj,
            markup.newLine,
            markup.newLine,
            resxObj,
            markup.newLine,
            markup.newLine,
            nameSpaceAssign,
        ].join('');

        return body;
    }

    static generateNamedImports(chunkName, languages, resxPrefix) {
        return languages.sort().map(l => `import { ${chunkName} as ${chunkName}${l} } from './${chunkName}${resxPrefix}.${l}';`).join(markup.newLine);
    }

    static genIStrs(json) {
        const keys = Object.keys(json).sort();
        return keys.map(k => `${markup.tab}${k}: string;`);
    }

    generateAll() {
        return pathUtility.readChunksNames()
            .then(chunks => {
                LogUtility.logSection('regenerating dist files');
                const ops = chunks.map(c => this.generateChunk(c));
                return Promise.all(ops);
            })
            .catch(LogUtility.logErr);
    }

    genIGlob(chunkName) {
        return `declare interface ${this.tsGlobInterface} {${markup.newLine}${markup.tab}${chunkName}: ${chunkName}${this.resxPrefix};${markup.newLine}}`;
    }

    genIObj(content, name) {
        return `interface ${name}${this.resxPrefix} {${markup.newLine}${content}${markup.newLine}}`;
    }

    genTypesBody(name, data) {
        const content = JSON.parse(data);
        const strings = DistGenerator.genIStrs(content);
        return [
            markup.autoGenStr,
            markup.tsLintDisable,
            markup.newLine,
            this.genIObj(strings.join(markup.newLine), name),
            markup.newLine,
            markup.newLine,
            this.genIGlob(name),
        ].join('');
    }

    generateChunkWrapper(srcLangFileData, chunkName) {
        const resxWrapperBody = this.genResxWrapperBody(srcLangFileData, chunkName);
        const filePath = pathUtility.getDistWrapperPath(chunkName);
        return DistGenerator.processJsonToJs(resxWrapperBody, filePath);
    }

    generateTypes(srcLangFileData, chunkName) {
        const typePath = pathUtility.getDefTypesPath(chunkName);
        const typeBody = this.genTypesBody(chunkName, srcLangFileData);
        return writeFileAsync(typePath, typeBody + markup.newLine, fsOptions.write);
    }

    generateChunk(chunkName, createMode) {
        const chunkDefaultSrc = pathUtility.getDefSrcFilePath(chunkName);
        return readFileAsync(chunkDefaultSrc, { encoding: 'utf8' })
            .then(srcLangFileData => {
                const wrapperRegenOp = this.generateChunkWrapper(srcLangFileData, chunkName);
                const typesRegenOp = this.generateTypes(srcLangFileData, chunkName);

                return Promise.all([wrapperRegenOp, typesRegenOp]);
            })
            .then(() => this.generateChunkLangs(chunkName))
            .then(() => {
                if (createMode) {
                    LogUtility.logChunkOperation(chunkName, 'Dist', createMode);
                }
            });
    }

    generateChunkLangs(chunkName) {
        const operations = this.languages.map(lang => {
            const srcFilePath = pathUtility.getSrcFilePath(chunkName, lang);

            return readFileAsync(srcFilePath, { encoding: 'utf8' })
                .then(srcLangFileData => {
                    const langJSData = JSON.parse(srcLangFileData);
                    const resxBody = DistGenerator.genResxDistBody(chunkName, langJSData);
                    const distFilePath = pathUtility.getDistFilePath(chunkName, lang);
                    return DistGenerator.processJsonToJs(resxBody, distFilePath);
                });
        });
        return Promise.all(operations);
    }
}

module.exports = DistGenerator;
