const fs = require('fs');
const { promisify } = require('util');
const inquirer = require('inquirer');
// const program = require('commander');
// const colors = require('colors');

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

const readFileAsync = promisify(fs.readFile);
const openAsync = promisify(fs.open);
const writeAsync = promisify(fs.write);
const closeAsync = promisify(fs.close);

const defaultLang = languages[0];
const getSrcFilePath = (chunkName, lang) => `${SRC_FOLDER}${chunkName}.${lang}.json`;

const regenerateSrc = () => {
    console.log('regenerating json files');
    const processChunk = chunkName => {
        const defaultLangPath = getSrcFilePath(chunkName, defaultLang);
        fs.readFile(defaultLangPath, (readFileErr, defaultLangData) => {
            if (readFileErr) throw readFileErr;

            const mainLangData = JSON.parse(defaultLangData);
            const mainLangKeys = Object.keys(mainLangData);
            languages.filter(lang => lang !== defaultLang).forEach(currentLang => {
                const filePath = getSrcFilePath(chunkName, currentLang);
                if (!fs.existsSync(filePath)) {
                    fs.open(filePath, 'w', 666, (openFileErr, id) => {
                        if (openFileErr) throw openFileErr;

                        fs.write(id, defaultLangData + NEW_LINE, null, 'utf8', () => {
                            fs.close(id, () => {
                                console.log('file is updated');
                            });
                        });
                    });
                }
                else {
                    fs.readFile(filePath, (err, cuurLangFiledata) => {
                        if (err) throw err;

                        const langData = JSON.parse(cuurLangFiledata);
                        const absentKeys = mainLangKeys.filter(k => !(k in langData));
                        if (absentKeys.length) {
                            const absentData = absentKeys.reduce((acc, k) => {
                                acc[k] = mainLangData[k];
                                return acc;
                            }, {});
                            const newLangData = {
                                ...langData,
                                ...absentData,
                            };
                            fs.open(filePath, 'w', 666, (currLangOpenErr, id) => {
                                if (currLangOpenErr) throw currLangOpenErr;

                                fs.write(id, JSON.stringify(newLangData, null, 4), null, 'utf8', () => {
                                    fs.close(id, () => {
                                        console.log(`${filePath} file is updated`);
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });
    };

    fs.readdir(SRC_FOLDER, (err, fileNames) => {
        fileNames.map(fn => fn.split('.')[0])
            .filter((v, i, a) => a.indexOf(v) === i)
            .forEach(chunkName => processChunk(chunkName));
    });
};

const regenerateDist = () => {
    const generateNamespaceAssign = () => `ep.resources = ep.resources || {};${NEW_LINE}`;
    const generateObject = (content, name) => `ep.resources.${name} = {${NEW_LINE}${content}${NEW_LINE}};`;
    const generateBody = (name, strings) => [
        generateNamespaceAssign(),
        NEW_LINE,
        generateObject(strings.join(`${NEW_LINE}`), name),
    ].join('');

    const process = (filename, body) => {
        const filePath = `${DIST_FOLDER}${filename}${RESX_PREFIX}.js`;
        fs.open(filePath, 'w', 666, (err, id) => {
            if (err) throw err;
            fs.write(id, body + NEW_LINE, null, 'utf8', () => {
                fs.close(id, () => {
                    console.log('file is regenerated');
                });
            });
        });
    };

    const generateStringsFromJson = json => {
        const keys = Object.keys(json).sort((a, b) => a > b);
        return keys.map(k => `${TAB}${k}: '${json[k]}',`);
    };

    const regenerateResx = (name, data, filename) => {
        const content = JSON.parse(data);
        const strings = generateStringsFromJson(content);
        const body = generateBody(name, strings);
        process(filename, body);
    };

    fs.readdir(SRC_FOLDER, (readDirErr, data) => {
        if (readDirErr) throw readDirErr;
        data.forEach(f => fs.readFile(`${SRC_FOLDER}${f}`, (readFileErr, content) => {
            if (readFileErr) throw readFileErr;
            const name = f.split('.').slice(0, -1).join('.');
            const filename = f.split('.')[0];
            regenerateResx(filename, content, name);
        }));
    });
};

const beginInteraction = () => {
    const actions = {
        create: 'create',
        add: 'add',
    };

    const actonsList = [
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
    ];

    const yesNo = {
        yes: 'Yes',
        no: 'No',
    };
    
    const yesNoList = [
        { name: yesNo.yes },
        { name: yesNo.no },
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
                        .then(id => (
                            writeAsync(id, JSON.stringify(newLangData, null, 4), null, 'utf8')
                                .then(() => (
                                    closeAsync(id)
                                        .then(() => console.log(`${filePath} file is updated`))
                                ))
                        ))
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

    inquirer
        .prompt(startupQuestions)
        .then(a => {
            if (a.action === actions.add) {
                addScenario(a.resxName);
            }
        });
};

beginInteraction();

//                          Functionality:
// TODO: + 'create new resx' functionality + possibility to add keys on create
// TODO: + remove key functionality
// TODO: add d.ts generation
// TODO: ???rework to classes

//                          Code refactoring:
// TODO: rework regenerateSrc function and regenerateDist into Pomise-based *To handle done state
// TODO: split all this hell into 3 modules

//                          Doubtful functionality:
// TODO: ???generate absent keys only to dist files instead of generating it into src
// TODO: ???remove file functionality
