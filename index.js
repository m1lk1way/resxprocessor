const fs = require('fs');
const { promisify } = require('util');
const inquirer = require('inquirer');
const program = require('commander');
const colors = require('colors');
const DistGenerator = require('./generators/distGenerator');
const SrcGenerator = require('./generators/srcGenerator');
const PathUtility = require('./utils/pathUtility');
const LogUtility = require('./utils/logUtility');
const Markup = require('./utils/markupUtility');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const initModule = ({
    tabSize, srcFolder, distFolder, resxPrefix, jsNamespace, tsGlobInterface, languages, defaultLang, currentLangNS,
}) => {
    /* utilities initialization */
    const pathUtility = new PathUtility();
    pathUtility.init(srcFolder, distFolder, defaultLang, resxPrefix);

    const markupUtility = new Markup();
    markupUtility.init(tabSize);

    const srcGenerator = new SrcGenerator(languages, defaultLang, srcFolder);
    const distGenerator = new DistGenerator(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS, tsGlobInterface);
    /* END */

    const generateAll = () => {
        srcGenerator.generateAll()
            .then(() => distGenerator.generateAll())
            .then(() => LogUtility.logSuccess())
            .catch(LogUtility.logErr);
    };

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

        const doAdd = (chunkName, keyName, keyLangs, langValPairs) => {
            const operations = keyLangs.map(l => {
                const filePath = pathUtility.getSrcFilePath(chunkName, l);
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
                                addScenario(chunkName);
                            }
                            else (distGenerator.generateChunk(chunkName));
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
            srcGenerator.generateEmptyChunk(resxName, callback);
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
            pathUtility.readChunksNames()
                .then(chunkNames => {
                    if (!chunkNames.length) {
                        LogUtility.logErr(`NO RESOURCES FOUND IN ${srcFolder}`);
                        askForRecursiveActions();
                        return;
                    }
                    const question = createSelectChankQuestion(chunkNames);
                    inquirer
                        .prompt(question)
                        .then(a => {
                            addScenario(a.addKey);
                        });
                })
                .catch(LogUtility.logErr)
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
                    generateAll();
                }
            });
    };

    program
        .option('-d, --dogood', 'Doing everything GOOD')
        .parse(process.argv);

    if (program.dogood) {
        generateAll();
    }
    else {
        beginInteraction();
    }
};

module.exports = initModule;

// todo: fix interactive mode and move all questions to its own utility;
