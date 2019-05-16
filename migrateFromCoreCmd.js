/* eslint-disable no-await-in-loop */
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
    const { corePath } = (await inquirer.prompt({
        type: 'input',
        message: 'Enter core project sources path',
        default: 'c:/projects/ep',
        name: 'corePath',
    }));
    const coreResxProvider = new CoreResxProvider(corePath);

    const coreResxFileName = (await inquirer.prompt({
        type: 'autocomplete',
        message: 'Select source (core) resx file: ',
        name: 'coreResxFile',
        source: async (answers, input) => {
            const resxFiles = await coreResxProvider.getResxFiles();
            return resxFiles.filter(x => !input || x.name.indexOf(input) >= 0)
                .map(x => x.name);
        },
    })).coreResxFile;


    const targetResource = await selectTargetResource();
    const langs = (await inquirer.prompt(langsQuestion)).keyLangs;
    const coreResxFile = await coreResxProvider.getFile(coreResxFileName);
    const sourceKeys = await coreResxFile.getKeys();

    let migrateOneMoreKey = yesNo.yes;
    while (migrateOneMoreKey === yesNo.yes) {
        const { sourceKey } = (await inquirer.prompt({
            type: 'autocomplete',
            message: 'Select source key: ',
            name: 'sourceKey',
            source: async (answers, input) => {
                return sourceKeys.filter(x => !input || x.toLowerCase().indexOf(input) >= 0);
            },
        }));

        const { targetKey } = await inquirer.prompt({
            type: 'input',
            message: 'Enter target key',
            default: sourceKey,
            name: 'targetKey',
        });

        // migrating keys
        const values = {};
        await Promise.all(langs.map(async lang => {
            const coreFile = await coreResxProvider.getFile(coreResxFileName, lang);
            if (!coreFile) {
                return;
            }
            const keyValue = await coreFile.getKeyValue(sourceKey);
            if (keyValue) {
                values[lang] = keyValue;
            }
        }));

        await addKeyToChunk(targetResource, targetKey, values);

        // ask for migrating one more key
        // eslint-disable-next-line prefer-destructuring
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
