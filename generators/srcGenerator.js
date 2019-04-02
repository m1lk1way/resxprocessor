const fs = require('fs');
const { promisify } = require('util');
const LogUtility = require('../utils/logUtility');
const PathUtility = require('../utils/pathUtility');
const SortUtility = require('../utils/sortUtility');
const fsOptions = require('../utils/fsOptions');
const Markup = require('../utils/markupUtility');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const pathUtility = new PathUtility();
const markupUtility = new Markup();

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

                    return writeFileAsync(filePath, JSON.stringify(newLangData, null, 4), fsOptions.write);
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
            });
    }

    generateEmptyChunk(chunkName) {
        const operations = this.languages.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return writeFileAsync(filePath, JSON.stringify({}), fsOptions.write);
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
                let srcData;

                try {
                    srcData = JSON.parse(defaultLangData);
                }
                catch (err) {
                    err.message = `${defaultLangPath}${markupUtility.newLine}${err.message}`;
                    throw err;
                }

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
                        return writeFileAsync(filePath, Markup.toSanitizedString(body), fsOptions.write)
                            .then(() => LogUtility.logSuccess(filePath))
                            .catch(LogUtility.logErr);
                    }
                    return readFileAsync(filePath, { encoding: 'utf8' })
                        .then(currLangFiledata => {
                            let langData;
                            try {
                                langData = JSON.parse(currLangFiledata);
                            }
                            catch (err) {
                                err.message = `${filePath}${markupUtility.newLine}${err.message}`;
                                throw err;
                            }

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
                        .then(newLangData => writeFileAsync(filePath, Markup.toSanitizedString(newLangData), fsOptions.write))
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
