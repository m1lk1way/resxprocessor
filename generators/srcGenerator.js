const fs = require('fs');
const { promisify } = require('util');
const LogUtility = require('../utils/logUtility');
const PathUtility = require('../utils/pathUtility');

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

    static sortSrc(obj) {
        const sortedSrc = Object.keys(obj)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .reduce((acc, key) => {
                acc[key] = obj[key];
                return acc;
            }, {});

        return sortedSrc;
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

    generateEmptyChunk(chunkName, callback) {
        const operations = this.languages.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return writeFileAsync(filePath, JSON.stringify({}), writeOptions);
        });

        return Promise.all(operations)
            .then(() => {
                LogUtility.logChunkCreate(chunkName);
                callback(chunkName);
            });
    }

    processChunk(chunkName) {
        const defaultLangPath = pathUtility.getDefSrcFilePath(chunkName);
        let mainLangData,
            mainLangKeys;

        return readFileAsync(defaultLangPath, { encoding: 'utf8' })
            .then(defaultLangData => {
                const srcData = JSON.parse(defaultLangData);
                mainLangData = SrcGenerator.sortSrc(srcData);
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
                            return SrcGenerator.sortSrc(langData);
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
