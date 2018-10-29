const fs = require('fs');
const { promisify } = require('util');
const inquirer = require('inquirer');
// const program = require('commander');
// const colors = require('colors');

const readFileAsync = promisify(fs.readFile);
const openAsync = promisify(fs.open);
const writeAsync = promisify(fs.write);
const closeAsync = promisify(fs.close);

const NEW_LINE = '\r\n';
const TABSIZE = 4;
const TAB = new Array(TABSIZE + 1).join(' ');
const SRC_FOLDER = './resxSrc/';
const DIST_FOLDER = './resxDist/';
const RESX_PREFIX = 'Resx';

const languages = [
    'en',
    'ru',
    'de',
    'fr',
    'es',
    'it',
    'pl',
    'sk',
    'tr',
];

const yesNo = {
    yes: 'Yes',
    no: 'No',
};

const yesNoList = [
    { name: yesNo.yes },
    { name: yesNo.no },
];

const defaultLang = languages[0];
const getSrcFilePath = (chunkName, lang) => `${SRC_FOLDER}${chunkName}.${lang}.json`;

const generateLogSection = (sectionText) => {
    console.log('-----------------------');
    console.log(`${sectionText}`);
    console.log('-----------------------');
}

const generateNamespaceAssign = () => `ep.resources = ep.resources || {};${NEW_LINE}`;
const generateObject = (content, name) => `ep.resources.${name} = {${NEW_LINE}${content}${NEW_LINE}};`;
const generateBody = (name, strings) => [
    generateNamespaceAssign(),
    NEW_LINE,
    generateObject(strings.join(`${NEW_LINE}`), name),
].join('');

const regenerateDist = (interactive = true) => {
    generateLogSection('regenerating dist files');
    const process = (filename, body, lang) => {
        const filePath = `${DIST_FOLDER}${filename}${RESX_PREFIX}.${lang}.js`;
        return openAsync(filePath, 'w', 666)
            .then((id) => {
                return writeAsync(id, body + NEW_LINE, null, 'utf8')
                    .then(() => {
                        return closeAsync(id)
                            .then(() => console.log(`${filePath} file is regenerated`))
                    })
            })
            .catch((distOpenErr) => console.log('ERROR:', distOpenErr))
    };

    const generateStringsFromJson = json => {
        const keys = Object.keys(json).sort((a, b) => a > b);
        return keys.map(k => `${TAB}${k}: '${json[k]}',`);
    };

    const regenerateResx = (resxName, data, lang) => {
        const content = JSON.parse(data);
        const strings = generateStringsFromJson(content);
        const body = generateBody(resxName, strings);
        return process(resxName, body, lang);
    };
    fs.readdir(SRC_FOLDER, (readDirErr, data) => {
        if (readDirErr) throw readDirErr;
        const operations = data.map(srcFileName => {
            const srcFilePath = `${SRC_FOLDER}${srcFileName}`;
            return readFileAsync(srcFilePath, { encoding: 'utf8' })
                .then((srcFileData) => {
                    const filenameData = srcFileName.split('.');
                    const [resxName, lang] = filenameData;
                    return regenerateResx(resxName, srcFileData, lang);
                })
                .catch((srcFileReadError) => console.log('ERROR:', srcFileReadError));
        });
        Promise.all(operations)
            .then(() => {
                if (interactive) {
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
                } 
                else {
                    console.log("ALL IS OK. Enjoy ;)")
                }
            })
    });
};

const regenerateSrc = (interactive = true) => {
    generateLogSection('regenerating src files');
    const processChunk = chunkName => {
        const defaultLangPath = getSrcFilePath(chunkName, defaultLang);
        return readFileAsync(defaultLangPath, { encoding: 'utf8' })
            .then(defaultLangData => {
                const mainLangData = JSON.parse(defaultLangData);
                const mainLangKeys = Object.keys(mainLangData);
                const operations = languages.filter(lang => lang !== defaultLang).map(currentLang => {
                    const filePath = getSrcFilePath(chunkName, currentLang);
                    if (!fs.existsSync(filePath)) {
                        return openAsync(filePath, 'w', 666)
                            .then(id => {
                                return writeAsync(id, defaultLangData + NEW_LINE, null, 'utf8')
                                    .then(() => {
                                        return closeAsync(id)
                                            .then(() => {
                                                console.log(`${filePath} - file is updated`);
                                            })
                                    })
                            })
                            .catch(openFileErr => console.log('ERROR:', openFileErr));
                    }
                    else {
                        return readFileAsync(filePath, { encoding: 'utf8' })
                            .then(currLangFiledata => {
                                const langData = JSON.parse(currLangFiledata);
                                const langDataKeys = Object.keys(langData);
                                const absentKeys = mainLangKeys.filter(k => !(k in langData));
                                const extraKeys = langDataKeys.filter(k => !(k in mainLangData));
                                if (extraKeys.length) {
                                    extraKeys.forEach(k => {
                                        delete langData[k]
                                        console.log(`extra key '${k}' has been deleted`);
                                    })
                                }
                                if (absentKeys.length || extraKeys.length) {
                                    const absentData = absentKeys.reduce((acc, k) => {
                                        acc[k] = mainLangData[k];
                                        return acc;
                                    }, {});
                                    const newLangData = {
                                        ...langData,
                                        ...absentData,
                                    };
                                    return openAsync(filePath, 'w', 666)
                                        .then(id => {
                                            return writeAsync(id, JSON.stringify(newLangData, null, 4), null, 'utf8')
                                                .then(() => {
                                                    return closeAsync(id)
                                                        .then(() => {
                                                            console.log(`${filePath} - file is updated`);
                                                        })
                                                })
                                        })
                                        .catch(currLangOpenErr => console.log('ERROR:', curLangFileReadErr))
                                }
                                else {
                                    console.log(`${filePath} - file is up to date`)
                                }
                            })
                            .catch(curLangFileReadErr => {
                                console.log('ERROR:', curLangFileReadErr)
                            })
                    }
                });
                return Promise.all(operations).then(() => {})
            })
            .catch(readDefaultLangErr => console.log('ERROR:', readDefaultLangErr))
    };

    fs.readdir(SRC_FOLDER, (err, fileNames) => {
        const chunkNames = fileNames.map(fn => fn.split('.')[0])
                                    .filter((v, i, a) => a.indexOf(v) === i);

        const operations = chunkNames.map(chunkName => processChunk(chunkName));
        Promise.all(operations)
        .then(() => {
            regenerateDist(false);
        })
    });
};

const generateEmptyChunk = (chunkName, callback) => {
    const operations = languages.map(l => {
        const filePath = getSrcFilePath(chunkName, l);
        return openAsync(filePath, 'w', 666)
                        .then(id => {
                            return writeAsync(id, JSON.stringify({}), null, 'utf8')
                                .then(() => {
                                    return closeAsync(id)
                                        .then(() => console.log(`${filePath} empty resource file was created`))
                                })
                        })
                        .catch(langOpenErr => console.log('ERROR:', langOpenErr));
    })
    Promise.all(operations)
        .then(() => {
            callback(chunkName);
        })
}

const beginInteraction = () => {
    const actions = {
        create: 'create',
        add: 'add',
        regenerateAll: "regenerateAll",
    };

    const actonsList = [
        { name: 'Do everything GOOD', value: actions.regenerateAll},
        { name: 'Create new resx File', value: actions.create },
        { name: 'Add keys to existing one', value: actions.add },
    ];

    const startupQuestions = [
        {
            type: 'list', name: 'action', message: 'What would you like to do', choices: actonsList,
        },
        {
            type: 'input',
            name: 'resxName',
            message: 'What\'s the name of resx file? ',
            when: a => a.action === actions.add,
            validate: resxName => {
                const exists = fs.existsSync(getSrcFilePath(resxName, defaultLang));
                return exists ? true : 'Resource doesn\'t exists';
            },
        },
        {
            type: 'input',
            name: 'resxName',
            message: 'Give it a name: ',
            when: a => a.action === actions.create,
            validate: resxName => {
                const exists = fs.existsSync(getSrcFilePath(resxName, defaultLang));
                return exists ? 'Resource file already exists' : true;
            },
        }
    ];

    const createDefaultLangs = [defaultLang, 'ru'];
    const langList = languages.map(l => ({ name: l }));

    const doLangKeyValQuestions = lang => ({
        type: 'input',
        name: 'val',
        message: `${lang} value for this key?`,
        validate: a => (a ? true : 'Can\'t add empty value'),
    });

    const doAddScenarioQuestions = resxName => [
        {
            type: 'input',
            name: 'keyName',
            message: 'Key name? ',
            validate: a => {
                const fileContent = JSON.parse(fs.readFileSync(getSrcFilePath(resxName, defaultLang), 'utf8'));
                return a in fileContent ? 'This key is already exists' : true;
            },
        },
        {
            type: 'checkbox',
            name: 'keyLangs',
            message: 'Which lang resources would you like to add keys to? ',
            choices: langList,
            default: createDefaultLangs,
        },
    ];

    const doAdd = (resxName, keyName, keyLangs, langValPairs) => {
        const operations = keyLangs.map(l => {
            const filePath = getSrcFilePath(resxName, l);
            return readFileAsync(filePath, { encoding: 'utf8' })
                .then(langData => {
                    const content = JSON.parse(langData);
                    const langVal = langValPairs[l];
                    const newLangData = {
                        ...content,
                        [keyName]: langVal,
                    };
                    return openAsync(filePath, 'w', 666)
                        .then(id => {
                            return writeAsync(id, JSON.stringify(newLangData, null, 4), null, 'utf8')
                                .then(() => {
                                    return closeAsync(id)
                                        .then(() => console.log(`${filePath} file is updated`))
                                })
                        })
                        .catch(langOpenErr => console.log('ERROR:', langOpenErr));
                })
                .catch(readLangErr => console.log('ERROR:', readLangErr));
        });
        Promise.all(operations)
            .then(() => {
                inquirer
                    .prompt({
                        type: 'list',
                        name: 'newKey',
                        message: 'Would you like to add one more key?',
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
                    const question = doLangKeyValQuestions(currLang);
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

    createScenario = (resxName) => {
        const callback = (resxName) => {
            inquirer
                .prompt({
                    type: 'list',
                    name: 'addKey',
                    message: 'Would you like to add some keys to it??',
                    choices: yesNoList,
                })
                .then(a => {
                    if(a.addKey === yesNo.yes) {
                        addScenario(resxName)
                    }
                });
        }
        generateEmptyChunk(resxName, callback);
    }

    inquirer
        .prompt(startupQuestions)
        .then(a => {
            if (a.action === actions.add) {
                addScenario(a.resxName);
            }
            if (a.action === actions.create) {
                createScenario(a.resxName)
            }
            if (a.action === actions.regenerateAll) {
                regenerateSrc(false);
            }
        });
};

// beginInteraction();
regenerateSrc(false)
//                          Functionality:
// TODO: + remove key functionality
// TODO: add d.ts generation
// TODO: ???rework to classes
// TODO
//                          Code refactoring:
// TODO: all openAsync(filePath, 'w', 666) move to helper function
// TODO: split all this hell into 3 modules
// TODO: move all trash (leke const variables, paths) to cfg and add ability to pass other config
// TODO: !!!move this package as global package

//                          Doubtful functionality:
// TODO: ???generate absent keys only to dist files instead of generating it into src
// TODO: ???remove file functionality
