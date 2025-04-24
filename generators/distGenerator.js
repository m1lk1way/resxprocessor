const fs = require('fs');
const { promisify } = require('util');
const jsStringEscape = require('js-string-escape');
const LogUtility = require('../utils/logUtility');
const PathUtility = require('../utils/pathUtility');
const MarkupUtility = require('../utils/markupUtility');
const SortUtility = require('../utils/sortUtility');
const fsOptions = require('../utils/fsOptions');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const pathUtility = new PathUtility();
const markup = new MarkupUtility();

class DistGenerator {
    constructor(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS) {
        this.jsNamespace = jsNamespace;
        this.languages = languages;
        this.defaultLang = defaultLang;
        this.resxPrefix = resxPrefix;
        this.srcFolder = srcFolder;
        this.currentLangNS = currentLangNS;
    }

    static genResxStrs(json) {
        const keys = Object.keys(SortUtility.sort(json));
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
        const langsMapObj = `const langMap: { [k: string]: Partial<typeof ${chunk}${this.defaultLang}> } = {${markup.newLine}${mapObjBody}${markup.newLine}};`;
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
        const resxObj = DistGenerator.genResxObj(strings.join(markup.newLine), name);
        return [
            markup.autoGenStr,
            markup.newLine,
            resxObj,
        ].join('');
    }

    static processJsonToJs(body, filePath) {
        const fileBody = body + markup.newLine;
        return writeFileAsync(filePath, fileBody, fsOptions.write);
    }

    static getSortedKeys(fileData) {
        const json = JSON.parse(fileData);
        const sortedJson = SortUtility.sort(json);

        return Object.keys(sortedJson);
    }

    static getCommentStr(text, defaultLang) {
        return `${markup.tab}/**${markup.newLine}`
        + `${markup.tab}* ${defaultLang}: ${text.replace("*/", "")}${markup.newLine}`
        + `${markup.tab}*/${markup.newLine}`
    }

    static genResxGetterStrs(srcJson, defaultLang, currentLangNS) {
        const keys = SortUtility.getSortedKeys(srcJson);
        
        const strings = keys.map(k => (
            this.getCommentStr(srcJson[k], defaultLang)
            + `${markup.tab}get ${k}() {${markup.newLine}${markup.tab}${markup.tab}return `
            + `langMap[${currentLangNS}].${k} || langMap.${defaultLang}.${k};${markup.newLine}${markup.tab}},`
        ));

        const ResxGetterStrs = strings.join(markup.newLine);
        return ResxGetterStrs;
    }

    genResxWrapperBody(srcJson, chunkName) {
        const wrapperChunkName = chunkName + this.resxPrefix;
        const imports = DistGenerator.generateNamedImports(chunkName, this.languages, this.resxPrefix);
        const langsMapObj = this.genLangsMapObj(chunkName);
        const content = DistGenerator.genResxGetterStrs(srcJson, this.defaultLang, this.currentLangNS);
        const resxObj = DistGenerator.genResxObj(content, wrapperChunkName);
        const emptyNameSpace = this.genNameSpaceAssign();
        const nameSpaceAssign = this.genAssignToNameSpace(chunkName, wrapperChunkName);

        const body = [
            markup.autoGenStr,
            markup.newLine,
            imports,
            markup.newLine,
            markup.newLine,
            langsMapObj,
            markup.newLine,
            markup.newLine,
            markup.tsLintDisableLength,
            resxObj,
            markup.newLine,
            markup.newLine,
            markup.tsIgnore,
            emptyNameSpace,
            markup.newLine,
            markup.tsIgnore,
            nameSpaceAssign,
        ].join('');

        return body;
    }

    static generateNamedImports(chunkName, languages, resxPrefix) {
        return languages.sort().map(l => `import { ${chunkName} as ${chunkName}${l} } from './${chunkName}${resxPrefix}.${l}';`).join(markup.newLine);
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

    generateChunkWrapper(srcJson, chunkName) {
        const resxWrapperBody = this.genResxWrapperBody(srcJson, chunkName);
        const filePath = pathUtility.getDistWrapperPath(chunkName);
        return DistGenerator.processJsonToJs(resxWrapperBody, filePath);
    }

    generateChunk(chunkName, createMode) {
        const chunkDefaultSrc = pathUtility.getDefSrcFilePath(chunkName);
        return readFileAsync(chunkDefaultSrc, { encoding: 'utf8' })
            .then(srcLangFileData => {
                const srcJson = MarkupUtility.parseToJson(srcLangFileData, chunkDefaultSrc);
                return this.generateChunkWrapper(srcJson, chunkName);
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
                    const langJSData = MarkupUtility.parseToJson(srcLangFileData, srcFilePath);
                    const resxBody = DistGenerator.genResxDistBody(chunkName, langJSData);
                    const distFilePath = pathUtility.getDistFilePath(chunkName, lang);
                    return DistGenerator.processJsonToJs(resxBody, distFilePath);
                });
        });
        return Promise.all(operations);
    }
}

module.exports = DistGenerator;
