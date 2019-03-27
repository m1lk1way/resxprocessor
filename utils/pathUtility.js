const fs = require('fs');
const { promisify } = require('util');
const LogUtility = require('../utils/logUtility');

const readdirAsync = promisify(fs.readdir);

let instance;

class PathUtility {
    constructor() {
        if (instance) {
            return instance;
        }
        instance = this;
    }

    init(srcFolder, distFolder, defaultLang, resxPrefix) {
        this.defaultLang = defaultLang;
        this.srcFolder = srcFolder;
        this.distFolder = distFolder;
        this.resxPrefix = resxPrefix;
    }

    getSrcFilePath(chunkName, lang) {
        return `${this.srcFolder}${chunkName}.${lang}.json`;
    }

    getDefSrcFilePath(chunkName) {
        return this.getSrcFilePath(chunkName, this.defaultLang);
    }

    getDistFilePath(chunkName, lang) {
        return `${this.distFolder}${chunkName}${this.resxPrefix}.${lang}.js`;
    }

    getDistWrapperPath(chunkName) {
        return `${this.distFolder}${chunkName}${this.resxPrefix}.ts`;
    }

    getDefDistFilePath(chunkName) {
        return this.getDistFilePath(chunkName, this.defaultLang);
    }

    getDefTypesPath(chunkName) {
        return `${this.distFolder}${chunkName}${this.resxPrefix}.def.d.ts`;
    }

    static getChunkByFileName(fileName) {
        return fileName.split('.')[0];
    }

    static getChunksNames(fileNames) {
        return fileNames.map(PathUtility.getChunkByFileName)
            .filter((v, i, a) => a.indexOf(v) === i);
    }

    readChunksNames() {
        return readdirAsync(this.srcFolder)
            .then(fileNames => {
                const chunks = PathUtility.getChunksNames(fileNames);
                return chunks;
            })
            .catch(LogUtility.logErr);
    }
}

module.exports = PathUtility;
