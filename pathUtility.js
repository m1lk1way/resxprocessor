let instance;

class PathUtility {
    constructor(srcFolder, distFolder, defaultLang, resxPrefix) {
        if (instance) {
            return instance;
        }

        this.defaultLang = defaultLang;
        this.srcFolder = srcFolder;
        this.distFolder = distFolder;
        this.resxPrefix = resxPrefix;
        
        instance = this;
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

    getDefDistFilePath(chunkName) {
        return this.getDistFilePath(chunkName, this.defaultLang);
    }

    getDefTypesPath(chunkName) {
        return `${this.distFolder}${chunkName}${this.resxPrefix}.${this.defaultLang}.d.ts`;
    }

    static getChunkByFileName(fileName) {
        return fileName.split('.')[0];
    }

    static getChunksNames(fileNames) {
        return fileNames.map(PathUtility.getChunkByFileName)
            .filter((v, i, a) => a.indexOf(v) === i);
    }
}

module.exports = PathUtility;
