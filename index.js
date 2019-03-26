const fs = require('fs');
const { promisify } = require('util');
const inquirer = require('inquirer');
const program = require('commander');
const colors = require('colors');
const jsStringEscape = require('js-string-escape');
const DistGenerator = require('./distGenerator');
const PathUtility = require('./pathUtility');
const LogUtility = require('./logUtility');

const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const writeFileAsync = promisify(fs.writeFile);

const sortObj = obj => Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
    }, {});

const initModule = ({
    tabSize, srcFolder, distFolder, resxPrefix, jsNamespace, tsGlobInterface, languages, defaultLang, currentLangNS,
}) => {
    /* utilities initialization */
    const pathUtility = new PathUtility(srcFolder, distFolder, defaultLang, resxPrefix);
    const distGenerator = new DistGenerator(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS, tsGlobInterface);
    
    /* END */
    const NEW_LINE = '\r\n';
    // const TAB = new Array(parseInt(tabSize, 10) + 1).join(' ');
    const writeOptions = { flag: 'w', mode: 666, encoding: 'utf8' };
    const yesNo = {
        yes: 'Yes',
        no: 'No',
    };

    const yesNoList = [
        { name: yesNo.yes },
        { name: yesNo.no },
    ];

    const checkCfgPathSync = path => {
        if (!fs.existsSync(path)) {
            console.log(`didn't find ${path}, you specified in .resxprocessor cfg file`);
            fs.mkdirSync(path);
            console.log('created it for you');
        }
    };
    checkCfgPathSync(srcFolder);
    checkCfgPathSync(distFolder);

    const getChunkByFileName = fileName => fileName.split('.')[0];
    const getChunksNames = fileNames => fileNames.map(getChunkByFileName)
        .filter((v, i, a) => a.indexOf(v) === i);
        
    const askForRecursiveActions = () => {
        inquirer
            .prompt({
                type: 'list',
                name: 'newKey',
                message: 'Would you like to do something else?',
                choices: yesNoList,
            })
            .then(a => {
                if (a.newKey === yesNo.yes) {
                    beginInteraction();
                }
            });
    };

    const regenerateSrc = (interactive = true) => {
        LogUtility.logSection('regenerating src files');

        const processChunk = chunkName => {
            const defaultLangPath = pathUtility.getDefSrcFilePath(chunkName);
            let mainLangData,
                mainLangKeys;

            return readFileAsync(defaultLangPath, { encoding: 'utf8' })
                .then(defaultLangData => {
                    mainLangData = sortObj(JSON.parse(defaultLangData));
                    mainLangKeys = Object.keys(mainLangData);
                })
                .then(() => {
                    writeFileAsync(defaultLangPath, JSON.stringify(mainLangData, null, 4), mainLangData);
                })
                .then(() => {
                    const operations = languages.filter(lang => lang !== defaultLang).map(currentLang => {
                        const filePath = pathUtility.getSrcFilePath(chunkName, currentLang);
                        let extraKeys,
                            hasExtraKeys;
                        if (!fs.existsSync(filePath)) {
                            const body = mainLangKeys.reduce((acc, v) => {
                                acc[v] = null;
                                return acc;
                            }, {});
                            return writeFileAsync(filePath, JSON.stringify(body, null, 4), writeOptions)
                                .then(() => console.log(colors.bgYellow(`${filePath} - file is updated`)))
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
                                return sortObj(langData);
                            })
                            .then(newLangData => writeFileAsync(filePath, JSON.stringify(newLangData, null, 4), writeOptions))
                            .then(() => {
                                if (hasExtraKeys) {
                                    console.log('----------------------');
                                    console.log(`${filePath} - found extra keys`);
                                    extraKeys.forEach(k => console.log(`'${k}' has been deleted`));
                                    console.log(colors.bgYellow(`${filePath} - file is updated`));
                                    console.log('----------------------');
                                }
                                else {
                                    console.log(`${filePath} - file is up to date`);
                                }
                            })
                            .catch(LogUtility.logErr);
                    });
                    
                    return Promise.all(operations);
                })
                .catch(LogUtility.logErr);
        };

        let chunks;
        readdirAsync(srcFolder)
            .then(fileNames => {
                chunks = getChunksNames(fileNames);
                const ops = chunks.map(c => processChunk(c));

                return Promise.all(ops);
            })
            .then(() => {
                const ops = chunks.map(c => distGenerator.regenerateChunkDist(c));
                return Promise.all(ops);
                // DistGenerator.regenerateDist(srcFolder, interactive);
            })
            .then(() => {
                LogUtility.logSuccess();
            })
            .catch(LogUtility.logErr);
    };

    const generateEmptyChunk = (chunkName, callback) => {
        const operations = languages.map(l => {
            const filePath = pathUtility.getSrcFilePath(chunkName, l);
            return writeFileAsync(filePath, JSON.stringify({}), writeOptions)
                .then(() => console.log(`${filePath} empty resource file was created`))
                .catch(LogUtility.logErr);
        });

        Promise.all(operations)
            .then(() => {
                callback(chunkName);
            });
    };

    const beginInteraction = () => {
        const actions = {
            create: 'create',
            add: 'add',
            regenerateAll: 'regenerateAll',
        };

        const actonsList = [
            { name: 'Do everything GOOD', value: actions.regenerateAll },
            { name: 'Create new resx File', value: actions.create },
            { name: 'Add keys to existing one', value: actions.add },
        ];

        const startupQuestions = [
            {
                type: 'list', name: 'action', message: 'Select operation?', choices: actonsList,
            },
            {
                type: 'input',
                name: 'resxName',
                message: 'Give it a name: ',
                when: a => a.action === actions.create,
                validate: resxName => {
                    const exists = fs.existsSync(pathUtility.getDefSrcFilePath(resxName));
                    return exists ? 'Resource file already exists' : true;
                },
            },
        ];

        const createDefaultLangs = [defaultLang, 'ru'];
        const langList = languages.map(l => ({ name: l }));

        const doLangKeyValQuestions = (lang, keyName) => ({
            type: 'input',
            name: 'val',
            message: `'${lang}' value for '${keyName}'?`,
            validate: a => (a ? true : 'Can\'t add empty value'),
        });

        const doAddScenarioQuestions = resxName => [
            {
                type: 'input',
                name: 'keyName',
                message: 'Key name? ',
                validate: a => {
                    const fileContent = JSON.parse(fs.readFileSync(pathUtility.getDefSrcFilePath(resxName), 'utf8'));
                    return a in fileContent ? 'This key is already exists' : true;
                },
            },
            {
                type: 'checkbox',
                name: 'keyLangs',
                message: 'Select languages:',
                choices: langList,
                default: createDefaultLangs,
            },
        ];

        const doAdd = (resxName, keyName, keyLangs, langValPairs) => {
            const operations = keyLangs.map(l => {
                const filePath = pathUtility.getSrcFilePath(resxName, l);
                return readFileAsync(filePath, { encoding: 'utf8' })
                    .then(langData => {
                        const content = JSON.parse(langData);
                        const langVal = langValPairs[l];
                        const newLangData = {
                            ...content,
                            [keyName]: langVal,
                        };
                        return writeFileAsync(filePath, JSON.stringify(newLangData, null, 4), writeOptions);
                    })
                    .then(() => console.log(colors.bgYellow(`${filePath} file is updated`)))
                    .catch(LogUtility.logErr);
            });
            Promise.all(operations)
                .then(() => {
                    inquirer
                        .prompt({
                            type: 'list',
                            name: 'newKey',
                            message: 'add one more key?',
                            choices: yesNoList,
                        })
                        .then(a => {
                            if (a.newKey === yesNo.yes) {
                                addScenario(resxName);
                            }
                            else (regenerateSrc());
                        });
                });
        };

        const addScenario = resxName => {
            const askForValues = (keyName, keyLangs) => {
                const langValPairs = [];
                let iteration = 0;
                const askForValue = () => {
                    const currLang = keyLangs[iteration];
                    if (langValPairs.length < keyLangs.length) {
                        const question = doLangKeyValQuestions(currLang, keyName);
                        inquirer
                            .prompt(question)
                            .then(a => {
                                langValPairs.push({ [currLang]: a.val });
                                iteration += 1;
                                askForValue();
                            });
                    }
                    else {
                        const langData = langValPairs.reduce((acc, val) => {
                            const key = Object.keys(val)[0];
                            acc[key] = val[key];
                            return acc;
                        }, {});
                        doAdd(resxName, keyName, keyLangs, langData);
                    }
                };
                askForValue();
            };

            const askForKey = () => {
                inquirer
                    .prompt(doAddScenarioQuestions(resxName))
                    .then(a => {
                        askForValues(a.keyName, a.keyLangs);
                    });
            };
            
            askForKey();
        };

        const createScenario = resxName => {
            const callback = name => {
                inquirer
                    .prompt({
                        type: 'list',
                        name: 'addKey',
                        message: 'add keys??',
                        choices: yesNoList,
                    })
                    .then(a => {
                        if (a.addKey === yesNo.yes) {
                            addScenario(name);
                        }
                    });
            };
            generateEmptyChunk(resxName, callback);
        };

        const createSelectChankQuestion = chunkNames => {
            const chunkList = chunkNames.map(chunkName => ({ name: chunkName }));
            return {
                type: 'list',
                name: 'addKey',
                message: 'Select resource: ',
                choices: chunkList,
            };
        };

        const readChunksAndAsk = () => {
            readdirAsync(srcFolder)
                .then(srcDirData => {
                    if (!srcDirData.length) {
                        LogUtility.logErr(`NO RESOURCES FOUND IN ${srcFolder}`);
                        askForRecursiveActions();
                        return;
                    }
                    const question = createSelectChankQuestion(getChunksNames(srcDirData));
                    inquirer
                        .prompt(question)
                        .then(a => {
                            addScenario(a.addKey);
                        });
                })
                .catch(LogUtility.logErr);
        };

        inquirer
            .prompt(startupQuestions)
            .then(a => {
                if (a.action === actions.add) {
                    readChunksAndAsk();
                }
                if (a.action === actions.create) {
                    createScenario(a.resxName);
                }
                if (a.action === actions.regenerateAll) {
                    regenerateSrc(false);
                }
            });
    };

    program
        .option('-d, --dogood', 'Doing everything GOOD')
        .parse(process.argv);

    if (program.dogood) {
        regenerateSrc(false);
    }
    else {
        beginInteraction();
    }
};

module.exports = initModule;
