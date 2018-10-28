"use strict";
const inquirer = require('inquirer');
const program = require('commander');
const colors = require('colors');
const fs = require('fs');

const LINE_END = "\r\n";
const TABSIZE = 4;
const TAB = new Array(TABSIZE + 1).join(" ");
const SRC_FOLDER = "./resxSrc/";
const DIST_FOLDER = "./resxDist/";
const resourcePrefix = "Resx";

const languages = [
    "en",
    "ru",
    "de",
    "fr",
    "es",
    "it",
    "pl",
    "sk",
    "tr",
];

const defaultLang = languages[0];
const getSrcFilePath = (chunkName, lang) => `${SRC_FOLDER}${chunkName}.${lang}.json`;

const regenerateSrc = () => {
    fs.readdir(SRC_FOLDER, (err, fileNames) => {
        const chunksNames = fileNames
                        .map(fn => fn.split('.')[0])
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .forEach(chunkName => processChunk(chunkName))
    });

    const processChunk = (chunkName) => {
        fs.readFile(getSrcFilePath(chunkName, defaultLang), (err, data) => {
            if (err) throw err;
            
            const mainLangData = JSON.parse(data);
            const mainLangKeys = Object.keys(mainLangData);
            languages.filter(lang => lang != defaultLang).forEach(currentLang => {
                const filePath = getSrcFilePath(chunkName, currentLang)
                if (!fs.existsSync(filePath)) {
                    const body = data;
                    fs.open(filePath, 'w', 666, function( err, id ) {
                        if (err) throw err;

                        fs.write( id, body + "\r\n", null, 'utf8', function(){
                            fs.close(id, function(){
                                console.log('file is updated');
                            });
                        });
                    });
                } else {
                    fs.readFile(filePath, (err, data) => {
                        if (err) throw err;

                        const langData = JSON.parse(data);
                        const absentKeys = mainLangKeys.filter(k => !(k in langData));
                        if (absentKeys.length) {
                            const absentData = absentKeys.reduce((acc, k) => {
                                acc[k] = mainLangData[k];
                                return acc;
                            }, {});
                            const newLangData = {
                                ...langData,
                                ...absentData
                            };
                            fs.open(filePath, 'w', 666, function( err, id ) {
                                if (err) throw err;

                                fs.write( id, JSON.stringify(newLangData, null, 4), null, 'utf8', function(){
                                    fs.close(id, function(){
                                        console.log(`${filePath} file is updated`);
                                    });
                                });
                            });
                        }
                    })
                }
            })
        })
    }
}

const regenerateDist = () => {
    fs.readdir(SRC_FOLDER, (err, data) => {
        if (err) throw err;
        data.forEach(f => fs.readFile(`${SRC_FOLDER}${f}`, (err, content) => {
            if (err) throw err;
            
            const name = f.split('.').slice(0, -1).join('.');
            const filename = f.split(".")[0];
            regenerateResx(filename, content, name);
        }))
    });
    
    const regenerateResx = (name, data, filename) => {
        const content = JSON.parse(data);
        const strings = generateStringsFromJson(content);
        const body = generateBody(name, strings);
        process(filename, body);
    }
    
    const generateNamespaceAssign = () => `ep.resources = ep.resources || {};${LINE_END}`;
    const generateObject = (content, name) => `ep.resources.${name} = {${LINE_END}${content}${LINE_END}};`;
    const generateBody = (name, strings) => [generateNamespaceAssign(), LINE_END, generateObject(strings.join(`${LINE_END}`), name)].join("");
    
    const generateStringsFromJson = (json) => {
        const keys = Object.keys(json).sort((a,b) => a > b);
        return keys.map(k => `${TAB}${k}: "${json[k]}",`);
    }
    
    function process (filename, body) {     
        fs.open(`${DIST_FOLDER}${filename}.js`, 'w', 666, function( err, id ) {
            if (err) throw err;
            fs.write( id, body + "\r\n", null, 'utf8', function(){
                fs.close(id, function(){
                    console.log('file is updated');
                });
            });
        });
    }
};

const ask = () => {
    const actions = {
        create: "create",
        add: "add",
    }

    const actonsList = [
        { name: 'Create new resx File', value: actions.create },
        { name: 'Add keys to existing one', value: actions.add },
    ];

    const startupQuestions = [
        { type: 'list', name: 'action', message: 'What would you like to do', choices: actonsList },
        {
            type: 'input',
            name: 'resxName',
            message: `What's the name of resx file? `,
            when: a => a.action == actions.add,
            validate: resxName => {
                if (!fs.existsSync(getSrcFilePath(resxName, defaultLang))){
                    return `Resource doesn't exists`;
                } else {
                    return true;
                }
            },
        }
    ]

    inquirer
        .prompt(startupQuestions)
        .then(a => {
            if(a.action == actions.add) {
                addScenario(a.resxName);
            }
        });

    const createDefaultLangs = [defaultLang, "ru"];
    const langList = languages.map(l => ({name: l}));

    const doLangKeyValQuestions = (lang) => ({
        type: 'input',
        name: 'val',
        message: `${lang} value for this key?`,
        validate: a => {
            return !!a ? true : `Can't add empty value`;
        },
    });

    const doAddScenarioQuestions = (resxName) => [
        {
            type: 'input',
            name: 'keyName',
            message: `Key name? `,
            validate: a => {
                const fileContent = JSON.parse(fs.readFileSync(getSrcFilePath(resxName, defaultLang), 'utf8'));
                return a in fileContent ? `This key is already exists` : true;
            },
        },
        {
            type: 'checkbox',
            name: 'keyLangs',
            message: 'Which lang resources would you like to add keys to',
            choices: langList,
            default: createDefaultLangs,
        },
    ];

    const doAdd = (resxName, keyName, keyLangs, langValPairs) => {
        keyLangs.forEach(l => {
            const filePath = getSrcFilePath(resxName, l);
            fs.readFile(filePath, (err, data) => {
                if (err) throw err;
                const content = JSON.parse(data);
                const langVal = langValPairs[l];
                const newLangData = {
                    ...content,
                    [keyName]: langVal,
                }
                console.log(newLangData);
                fs.open(filePath, 'w', 666, function( err, id ) {
                    if (err) throw err;
                    fs.write( id, JSON.stringify(newLangData, null, 4), null, 'utf8', function(){
                        fs.close(id, function(){
                            console.log(`${filePath} file is updated`);
                        });
                    });
                });
            });
        });
        // addScenario(resxName);
        // TODO: handle DONE state somehow and call ^;
    };

    const addScenario = (resxName) => {
        const askForKey = () => {
            inquirer.prompt(doAddScenarioQuestions(resxName))
            .then(a => {
                askForValues(a.keyName, a.keyLangs);
            });
        };
        const askForValues = (keyName, keyLangs) => {
            let langValPairs = [];
            let iteration = 0;
            const askForValue = (v = {}) => {
                const values = v;
                const currLang = keyLangs[iteration];
                if (langValPairs.length < keyLangs.length) {
                    const question = doLangKeyValQuestions(currLang);
                    inquirer
                        .prompt(question)
                        .then(a => {
                            langValPairs.push({[currLang]: a.val});
                            ++iteration;
                            askForValue();
                        }); 
                } else {
                    const langData = langValPairs.reduce((acc, val) => {
                        const key = Object.keys(val)[0];
                        acc[key] = val[key];
                        return acc;
                    }, {})
                    doAdd(resxName, keyName, keyLangs, langData);
                }
            }
            askForValue();
        };
        askForKey();
    };
}
 
// TODO: complete 'add new resx' functionality + possibility to add keys on create
// TODO: remove key in src file if it does not exists in default lang file
// TODO: not sure: generate absent keys only to dist files instead of generating it into src
// TODO: add posibility to add keys into file recoursively (add key? => done => add key? => done => ...)