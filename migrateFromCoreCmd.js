const inquirer = require('inquirer');
const CoreResxProvider = require('./utils/coreResxProvider');

const migrateResxFromCoreCmd = async ({
    addKeyToChunk,
    selectTargetResource,
    langsQuestion,
    yesNo,
    yesNoList,
    askForRecursiveActions,
}) => {
    let corePath = (await inquirer.prompt({
        type: 'input',
        message: 'Enter core project sources path',
        default: 'c:/projects/ep',
        name: 'corePath',
    })).corePath;
    let coreResxProvider = new CoreResxProvider(corePath);

    let coreResxFileName = (await inquirer.prompt({
        type: "autocomplete",
        message: 'Select source (core) resx file: ',
        name: "coreResxFile",
        source: async (answers, input) => {
            let resxFiles = await coreResxProvider.getResxFiles();
            return resxFiles.filter(x => !input || x.name.indexOf(input) >= 0)
                            .map( x => x.name)
        }
    })).coreResxFile;


    let targetResource = await selectTargetResource();
    let langs = (await inquirer.prompt(langsQuestion)).keyLangs;
    let coreResxFile = await coreResxProvider.getFile(coreResxFileName);
    let sourceKeys = await coreResxFile.getKeys();

    let migrateOneMoreKey = yesNo.yes;
    while(migrateOneMoreKey === yesNo.yes) {
        let sourceKey = (await inquirer.prompt({
            type: "autocomplete",
            message: 'Select source (core) resx file: ',
            name: "sourceKey",
            source: async (answers, input) => {
                return sourceKeys.filter(x => !input || x.toLowerCase().indexOf(input) >= 0)
            }
        })).sourceKey;

        let targetKey = (await inquirer.prompt({
            type: 'input',
            message: 'Enter target key',
            default: sourceKey,
            name: 'targetKey',
        })).targetKey;

        // migrating keys
        let values = {};
        await Promise.all(langs.map(async lang => {
            let coreFile = await coreResxProvider.getFile(coreResxFileName, lang);
            if(!coreFile) {
                return;
            }
            let keyValue = await coreFile.getKeyValue(sourceKey);
            if(keyValue) {
                values[lang] = keyValue;
            }
        }));

        await addKeyToChunk(targetResource, targetKey, values);

        // ask for migrating one more key
        migrateOneMoreKey = (await inquirer.prompt({
            type: 'list',
            name: 'migrateOneMoreKey',
            message: 'migrate one more key?',
            choices: yesNoList,
        })).migrateOneMoreKey;
    }

    askForRecursiveActions();
};

module.exports = migrateResxFromCoreCmd;