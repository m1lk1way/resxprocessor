const fs = require('fs');
const { promisify } = require('util');
const LogUtility = require('../utils/logUtility');
const PathUtility = require('../utils/pathUtility');
const SortUtility = require('../utils/sortUtility');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const writeOptions = { flag: 'w', mode: 666, encoding: 'utf8' }; // перетянуть, повторения выкосить

const pathUtility = new PathUtility();

class SrcGenerator {
    constructor(languages, defaultLang, srcFolder) {
        this.languages = languages;
        this.defaultLang = defaultLang;
        this.srcFolder = srcFolder;
    }

    static checkChunkExistance(chunkName) {
        return fs.existsSync(pathUtility.getDefSrcFilePath(chunkName));
    }

    static readDefaultLangChunk(chunkName) {
        const fileData = fs.readFileSync(pathUtility.getDefSrcFilePath(chunkName), 'utf8');
        return JSON.parse(fileData);
    }

    static addKey(chunkName, keyName, langValPairs) {
        const langsToAdd = Object.keys(langValPairs);
        
        const ops = langsToAdd.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return readFileAsync(filePath, { encoding: 'utf8' })
                .then(langData => {
                    const content = JSON.parse(langData);
                    const langVal = langValPairs[lang];
                    const newLangData = {
                        ...content,
                        [keyName]: langVal,
                    };

                    return writeFileAsync(filePath, JSON.stringify(newLangData, null, 4), writeOptions);
                })
                .then(() => {
                    LogUtility.logLine();
                    LogUtility.logKeyAdd(keyName, filePath);
                })
                .catch(LogUtility.logErr);
        });

        return Promise.all(ops)
            .catch(LogUtility.logErr);
    }
    
    generateAll() {
        return pathUtility.readChunksNames()
            .then(chunks => {
                LogUtility.logSection('regenerating src files');
                const ops = chunks.map(chunkName => this.processChunk(chunkName));
                return Promise.all(ops);
            })
            .catch(LogUtility.logErr);
    }

    generateEmptyChunk(chunkName) {
        const operations = this.languages.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return writeFileAsync(filePath, JSON.stringify({}), writeOptions);
        });

        return Promise.all(operations)
            .then(() => {
                LogUtility.logChunkOperation(chunkName, 'Src', 'created');
            });
    }

    processChunk(chunkName) {
        const defaultLangPath = pathUtility.getDefSrcFilePath(chunkName);
        let mainLangData,
            mainLangKeys;

        return readFileAsync(defaultLangPath, { encoding: 'utf8' })
            .then(defaultLangData => {
                const srcData = JSON.parse(defaultLangData);
                mainLangData = SortUtility.sort(srcData);
                mainLangKeys = Object.keys(mainLangData);
            })
            .then(() => {
                const operations = this.languages.map(currentLang => {
                    const filePath = pathUtility.getSrcFilePath(chunkName, currentLang);
                    let extraKeys,
                        hasExtraKeys;
                    if (!fs.existsSync(filePath)) {
                        const body = mainLangKeys.reduce((acc, v) => {
                            acc[v] = null;
                            return acc;
                        }, {});
                        return writeFileAsync(filePath, JSON.stringify(body, null, 4), writeOptions)
                            .then(() => LogUtility.logSuccess(filePath))
                            .catch(LogUtility.logErr);
                    }
                    return readFileAsync(filePath, { encoding: 'utf8' })
                        .then(currLangFiledata => {
                            let langData = JSON.parse(currLangFiledata);
                            const langDataKeys = Object.keys(langData);
                            const absentKeys = mainLangKeys.filter(k => !(k in langData));
                            
                            extraKeys = langDataKeys.filter(k => !(k in mainLangData));
                            hasExtraKeys = !!extraKeys.length;

                            if (absentKeys.length || hasExtraKeys) {
                                if (hasExtraKeys) {
                                    extraKeys.forEach(k => {
                                        delete langData[k];
                                    });
                                }
                                const absentData = absentKeys.reduce((acc, k) => {
                                    acc[k] = null;
                                    return acc;
                                }, {});

                                langData = {
                                    ...langData,
                                    ...absentData,
                                };
                            }
                            return SortUtility.sort(langData);
                        })
                        .then(newLangData => writeFileAsync(filePath, JSON.stringify(newLangData, null, 4), writeOptions))
                        .then(() => {
                            if (hasExtraKeys) {
                                console.log('----------------------');
                                console.log(`${filePath} - found extra keys`);
                                extraKeys.forEach(LogUtility.logKeyDelete);
                                LogUtility.logFileUpdate(filePath);
                                console.log('----------------------');
                            }
                        })
                        .catch(LogUtility.logErr);
                });
                
                return Promise.all(operations);
            })
            .catch(LogUtility.logErr);
    }
}

module.exports = SrcGenerator;
