import fs from "fs";
import { promisify } from "util";
import LogUtility from "../utils/logUtility.js";
import PathUtility from "../utils/pathUtility.js";
import MarkupUtility from "../utils/markupUtility.js";
import SortUtility from "../utils/sortUtility.js";
import fsOptions from "../utils/fsOptions.js";

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const pathUtility = new PathUtility();
const markup = new MarkupUtility();

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
        const fileData = fs.readFileSync(pathUtility.getDefSrcFilePath(chunkName), "utf8");
        return JSON.parse(fileData);
    }

    static addKey(chunkName, keyName, langValPairs) {
        const langsToAdd = Object.keys(langValPairs);

        const ops = langsToAdd.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return readFileAsync(filePath, { encoding: "utf8" })
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

        return Promise.all(ops).catch(LogUtility.logErr);
    }

    static readChunkFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return Promise.resolve({
                exists: false,
                content: {},
            });
        }

        return readFileAsync(filePath, { encoding: "utf8" }).then(fileData => ({
            exists: true,
            content: MarkupUtility.parseToJson(fileData, filePath),
        }));
    }

    static writeChunkFile(filePath, content) {
        return writeFileAsync(filePath, MarkupUtility.toSanitizedString(SortUtility.sort(content)), fsOptions.write);
    }

    static restoreChunkFile(filePath, snapshot) {
        if (!snapshot.exists) {
            if (!fs.existsSync(filePath)) {
                return Promise.resolve();
            }

            return unlinkAsync(filePath).catch(err => {
                if (err.code === "ENOENT") {
                    return;
                }

                throw err;
            });
        }

        return SrcGenerator.writeChunkFile(filePath, snapshot.content);
    }

    static normalizeMoveMappings(keyMappings) {
        if (!Array.isArray(keyMappings) || !keyMappings.length) {
            throw new Error("At least one key must be selected to move");
        }

        return keyMappings.map(({ sourceKeyName, targetKeyName = sourceKeyName }) => {
            if (!sourceKeyName || !targetKeyName) {
                throw new Error("Source and target key names are required for move operation");
            }

            return {
                sourceKeyName,
                targetKeyName,
            };
        });
    }

    async moveKeys(sourceChunkName, targetChunkName, keyMappings) {
        if (sourceChunkName === targetChunkName) {
            throw new Error("Source and target resource files must be different");
        }

        const normalizedMappings = SrcGenerator.normalizeMoveMappings(keyMappings);
        const sourceKeyNames = normalizedMappings.map(mapping => mapping.sourceKeyName);
        const targetKeyNames = normalizedMappings.map(mapping => mapping.targetKeyName);

        if (new Set(sourceKeyNames).size !== sourceKeyNames.length) {
            throw new Error("Source keys to move must be unique");
        }

        if (new Set(targetKeyNames).size !== targetKeyNames.length) {
            throw new Error("Target key names must be unique");
        }

        const sourceDefaultData = SrcGenerator.readDefaultLangChunk(sourceChunkName);
        sourceKeyNames.forEach(sourceKeyName => {
            if (!(sourceKeyName in sourceDefaultData)) {
                throw new Error(`Key \"${sourceKeyName}\" doesn't exist in source file`);
            }
        });

        const targetDefaultData = SrcGenerator.readDefaultLangChunk(targetChunkName);
        const reservedTargetKeys = new Set(Object.keys(targetDefaultData));

        normalizedMappings.forEach(({ targetKeyName }) => {
            if (reservedTargetKeys.has(targetKeyName)) {
                throw new Error(`Key \"${targetKeyName}\" already exists in the target file`);
            }

            reservedTargetKeys.add(targetKeyName);
        });

        const operations = await Promise.all(
            this.languages.map(async lang => {
                const sourceFilePath = pathUtility.getSrcFilePath(sourceChunkName, lang);
                const targetFilePath = pathUtility.getSrcFilePath(targetChunkName, lang);
                const [sourceSnapshot, targetSnapshot] = await Promise.all([
                    SrcGenerator.readChunkFile(sourceFilePath),
                    SrcGenerator.readChunkFile(targetFilePath),
                ]);
                const nextTargetContent = {
                    ...targetSnapshot.content,
                };
                const nextSourceContent = {
                    ...sourceSnapshot.content,
                };

                normalizedMappings.forEach(({ sourceKeyName, targetKeyName }) => {
                    const sourceHasKey = sourceKeyName in sourceSnapshot.content;

                    nextTargetContent[targetKeyName] = sourceHasKey ? sourceSnapshot.content[sourceKeyName] : null;
                    delete nextSourceContent[sourceKeyName];
                });

                return {
                    sourceFilePath,
                    targetFilePath,
                    sourceSnapshot,
                    targetSnapshot,
                    nextSourceContent,
                    nextTargetContent,
                };
            }),
        );

        const writtenTargets = [];
        const writtenSources = [];

        try {
            for (const operation of operations) {
                await SrcGenerator.writeChunkFile(operation.targetFilePath, operation.nextTargetContent);
                writtenTargets.push(operation);
            }

            for (const operation of operations) {
                await SrcGenerator.writeChunkFile(operation.sourceFilePath, operation.nextSourceContent);
                writtenSources.push(operation);
            }

            return {
                sourceChunkName,
                targetChunkName,
                keyMappings: normalizedMappings,
            };
        } catch (err) {
            const rollbackErrors = [];

            try {
                await Promise.all(
                    writtenSources.map(operation =>
                        SrcGenerator.restoreChunkFile(operation.sourceFilePath, operation.sourceSnapshot),
                    ),
                );
            } catch (rollbackErr) {
                rollbackErrors.push(rollbackErr.message);
            }

            try {
                await Promise.all(
                    writtenTargets.map(operation =>
                        SrcGenerator.restoreChunkFile(operation.targetFilePath, operation.targetSnapshot),
                    ),
                );
            } catch (rollbackErr) {
                rollbackErrors.push(rollbackErr.message);
            }

            if (rollbackErrors.length) {
                err.message = `${err.message}${markup.newLine}Rollback failed:${markup.newLine}${rollbackErrors.join(markup.newLine)}`;
            }

            throw err;
        }
    }

    async moveKey(sourceChunkName, sourceKeyName, targetChunkName, targetKeyName = sourceKeyName) {
        await this.moveKeys(sourceChunkName, targetChunkName, [{ sourceKeyName, targetKeyName }]);

        return {
            sourceChunkName,
            sourceKeyName,
            targetChunkName,
            targetKeyName,
        };
    }

    generateAll() {
        return pathUtility.readChunksNames().then(chunks => {
            LogUtility.logSection("regenerating src files");
            const ops = chunks.map(chunkName => this.processChunk(chunkName));
            return Promise.all(ops);
        });
    }

    generateEmptyChunk(chunkName) {
        const operations = this.languages.map(lang => {
            const filePath = pathUtility.getSrcFilePath(chunkName, lang);
            return writeFileAsync(filePath, JSON.stringify({}), fsOptions.write);
        });

        return Promise.all(operations).then(() => {
            LogUtility.logChunkOperation(chunkName, "Src", "created");
        });
    }

    processChunk(chunkName) {
        const defaultLangPath = pathUtility.getDefSrcFilePath(chunkName);
        let mainLangData, mainLangKeys;

        return readFileAsync(defaultLangPath, { encoding: "utf8" })
            .then(defaultLangData => {
                let srcData;

                try {
                    srcData = JSON.parse(defaultLangData);
                } catch (err) {
                    err.message = `${defaultLangPath}${markup.newLine}${err.message}`;
                    throw err;
                }

                mainLangData = SortUtility.sort(srcData);
                mainLangKeys = Object.keys(mainLangData);
            })
            .then(() => {
                const operations = this.languages.map(currentLang => {
                    const filePath = pathUtility.getSrcFilePath(chunkName, currentLang);
                    let extraKeys, hasExtraKeys;
                    if (!fs.existsSync(filePath)) {
                        const body = mainLangKeys.reduce((acc, v) => {
                            acc[v] = null;
                            return acc;
                        }, {});
                        return writeFileAsync(filePath, MarkupUtility.toSanitizedString(body), fsOptions.write)
                            .then(() => LogUtility.logSrcCreation(filePath))
                            .catch(LogUtility.logErr);
                    }
                    return readFileAsync(filePath, { encoding: "utf8" })
                        .then(currLangFiledata => {
                            let langData;
                            try {
                                langData = JSON.parse(currLangFiledata);
                            } catch (err) {
                                err.message = `${filePath}${markup.newLine}${err.message}`;
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
                        .then(newLangData =>
                            writeFileAsync(filePath, MarkupUtility.toSanitizedString(newLangData), fsOptions.write),
                        )
                        .then(() => {
                            if (hasExtraKeys) {
                                console.log("----------------------");
                                console.log(`${filePath} - found extra keys`);
                                extraKeys.forEach(LogUtility.logKeyDelete);
                                LogUtility.logFileUpdate(filePath);
                                console.log("----------------------");
                            }
                        })
                        .catch(LogUtility.logErr);
                });

                return Promise.all(operations);
            })
            .catch(LogUtility.logErr);
    }
}

export default SrcGenerator;
