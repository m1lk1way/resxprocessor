import "colors";
import inquirer from "inquirer";
import path from "path";
import { search as searchPrompt } from "@inquirer/prompts";
import checkboxPlus from "inquirer-checkbox-plus-plus";
import { Option, program } from "commander";
import DistGenerator from "./generators/distGenerator.js";
import SrcGenerator from "./generators/srcGenerator.js";
import PathUtility from "./utils/pathUtility.js";
import LogUtility from "./utils/logUtility.js";
import Markup from "./utils/markupUtility.js";

const initModule = ({
    tabSize,
    srcFolder,
    distFolder,
    resxPrefix,
    jsNamespace,
    languages,
    defaultLang,
    currentLangNS,
}) => {
    /* utilities initialization */
    const pathUtility = new PathUtility();
    pathUtility.init(srcFolder, distFolder, defaultLang, resxPrefix);

    const markupUtility = new Markup();
    markupUtility.init(tabSize);

    const srcGenerator = new SrcGenerator(languages, defaultLang, srcFolder);
    const distGenerator = new DistGenerator(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS);
    /* END */

    const generateAll = () => {
        srcGenerator
            .generateAll()
            .then(() => distGenerator.generateAll())
            .then(() => LogUtility.logSuccess())
            .catch(LogUtility.logErr);
    };

    const yesNo = {
        yes: "Yes",
        no: "No",
    };

    const yesNoList = [{ name: yesNo.yes }, { name: yesNo.no }];

    const askForRecursiveActions = () => {
        inquirer
            .prompt({
                type: "select",
                name: "newKey",
                message: "Would you like to do something else?",
                choices: yesNoList,
            })
            .then(a => {
                if (a.newKey === yesNo.yes) {
                    beginInteraction();
                }
            });
    };

    const isValidJSName = name => name.trim().length && !/^[^a-zA-Z_]+|[^a-zA-Z_0-9]+/.test(name);

    const collectOptionValues = (value, previousValues) => [
        ...previousValues,
        ...value
            .split(",")
            .map(item => item.trim())
            .filter(Boolean),
    ];

    const cliHelpText = [
        "",
        "Move options (use together with --move):",
        "  -s, --source <file>  source resource name or file name",
        "  -k, --key <key>      key name to move; repeat the option or use commas for multiple keys",
        "  -t, --target <file>  target resource name or file name",
        "  -n, --new-key <key>  optional target key name; repeat the option or use commas to map multiple keys by order",
        "",
    ].join("\n");

    const normalizeChunkInput = chunkInput => PathUtility.getChunkByFileName(path.basename(chunkInput.trim()));

    const resolveChunkName = (chunkInput, chunkNames, chunkRole) => {
        const normalizedChunkName = normalizeChunkInput(chunkInput);

        if (!normalizedChunkName || !chunkNames.includes(normalizedChunkName)) {
            throw new Error(`${chunkRole} resource file "${chunkInput}" was not found in ${srcFolder}`);
        }

        return normalizedChunkName;
    };

    const runMoveOperation = async ({ sourceChunkName, targetChunkName, keyMappings }) => {
        await srcGenerator.moveKeys(sourceChunkName, targetChunkName, keyMappings);
        await updateAffectedChunks([sourceChunkName, targetChunkName]);
        LogUtility.logKeysMoveSuccess(keyMappings, targetChunkName);
    };

    const runMoveCommand = async commandOptions => {
        try {
            const sourceKeyNames = commandOptions.key || [];
            const targetKeyNames = commandOptions.newKey || [];

            if (!commandOptions.source || !commandOptions.target || !sourceKeyNames.length) {
                throw new Error("Move mode requires --source, --key, and --target");
            }

            if (targetKeyNames.length && targetKeyNames.length !== sourceKeyNames.length) {
                throw new Error("Provide the same number of --new-key values as --key values, or omit --new-key");
            }

            const invalidKeyName = [...sourceKeyNames, ...targetKeyNames].find(keyName => !isValidJSName(keyName));

            if (invalidKeyName) {
                throw new Error(`Key name "${invalidKeyName}" isn't valid`);
            }

            const chunkNames = (await pathUtility.readChunksNames()) || [];

            if (chunkNames.length < 2) {
                throw new Error(`AT LEAST TWO RESOURCES REQUIRED IN ${srcFolder}`);
            }

            const sourceChunkName = resolveChunkName(commandOptions.source, chunkNames, "Source");
            const targetChunkName = resolveChunkName(commandOptions.target, chunkNames, "Target");
            const keyMappings = sourceKeyNames.map((sourceKeyName, index) => ({
                sourceKeyName,
                targetKeyName: targetKeyNames[index] || sourceKeyName,
            }));

            await runMoveOperation({
                sourceChunkName,
                targetChunkName,
                keyMappings,
            });
        } catch (err) {
            LogUtility.logErr(err);
            process.exitCode = 1;
        }
    };

    const updateAffectedChunks = chunkNames => {
        const uniqueChunkNames = [...new Set(chunkNames)];

        return Promise.all(uniqueChunkNames.map(chunkName => srcGenerator.processChunk(chunkName))).then(() =>
            Promise.all(uniqueChunkNames.map(chunkName => distGenerator.generateChunk(chunkName, "updated"))),
        );
    };

    const beginInteraction = () => {
        const actions = {
            create: "create",
            add: "add",
            move: "move",
            regenerateAll: "regenerateAll",
            quit: "quit",
        };

        const actonsList = [
            { name: "Do everything GOOD", value: actions.regenerateAll },
            { name: "Create new resx", value: actions.create },
            { name: "Add keys to existing one", value: actions.add },
            { name: "Move keys to another resource file", value: actions.move },
            { name: "Quit", value: actions.quit },
        ];

        const startupQuestions = [
            {
                type: "select",
                name: "action",
                message: "Select operation?",
                choices: actonsList,
            },
            {
                type: "input",
                name: "resxName",
                message: "Give it a name: ",
                when: a => a.action === actions.create,
                validate: resxName => {
                    const exists = SrcGenerator.checkChunkExistance(resxName);
                    const isValidName = isValidJSName(resxName);
                    if (exists || !isValidName) {
                        return exists ? "Resource file already exists" : "Resource file name isn't valid";
                    }
                    return true;
                },
            },
        ];

        const defaultSelectedLangs = [defaultLang, "ru"];
        const langList = languages.map(l => ({ name: l }));

        const doLangKeyValQuestions = (lang, keyName) => ({
            type: "input",
            name: "val",
            message: `'${lang}' value for '${keyName}'?`,
            validate: a => (a ? true : "Can't add empty value"),
        });

        const doAddScenarioQuestions = resxName => [
            {
                type: "input",
                name: "keyName",
                message: "Key name? ",
                validate: name => {
                    const fileContent = SrcGenerator.readDefaultLangChunk(resxName);
                    const isValidName = isValidJSName(name);
                    const exists = name in fileContent;

                    if (exists || !isValidName) {
                        return exists ? "This key is already exists" : "Key name isn't valid";
                    }

                    return true;
                },
            },
            {
                type: "checkbox",
                name: "keyLangs",
                message: "Select languages:",
                choices: langList,
                default: defaultSelectedLangs,
                validate: list => {
                    const isDefaultLangSelected = list.map(x => x.value).includes(defaultLang);
                    return isDefaultLangSelected ? true : `Default language (${defaultLang}) must be selected`;
                },
            },
        ];

        const doAdd = (chunkName, keyName, langValPairs) => {
            SrcGenerator.addKey(chunkName, keyName, langValPairs)
                .then(() => srcGenerator.processChunk(chunkName))
                .then(() => distGenerator.generateChunk(chunkName, "updated"))
                .then(() => {
                    inquirer
                        .prompt({
                            type: "select",
                            name: "newKey",
                            message: "add one more key?",
                            choices: yesNoList,
                        })
                        .then(a => {
                            switch (a.newKey) {
                                case yesNo.yes:
                                    return addScenario(chunkName);
                                default:
                                    return askForRecursiveActions();
                            }
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
                        inquirer.prompt(question).then(a => {
                            langValPairs.push({ [currLang]: a.val });
                            iteration += 1;
                            askForValue();
                        });
                    } else {
                        const langData = langValPairs.reduce((acc, val) => {
                            const key = Object.keys(val)[0];
                            acc[key] = val[key];
                            return acc;
                        }, {});

                        doAdd(resxName, keyName, langData);
                    }
                };

                askForValue();
            };

            const askForKey = () => {
                inquirer.prompt(doAddScenarioQuestions(resxName)).then(a => {
                    askForValues(a.keyName, a.keyLangs);
                });
            };

            askForKey();
        };

        const askForAddKeys = chunkName => {
            inquirer
                .prompt({
                    type: "select",
                    name: "addKey",
                    message: "add keys??",
                    choices: yesNoList,
                })
                .then(a => {
                    switch (a.addKey) {
                        case yesNo.yes:
                            return addScenario(chunkName);
                        default:
                            return askForRecursiveActions();
                    }
                });
        };

        const createScenario = resxName => {
            srcGenerator
                .generateEmptyChunk(resxName)
                .then(() => distGenerator.generateChunk(resxName, "created"))
                .then(() => askForAddKeys(resxName))
                .catch(LogUtility.logErr);
        };

        const askForChunkSelection = async (message, chunkNames) => {
            const normalizedChunkNames = [...chunkNames].sort((a, b) => a.localeCompare(b));

            return searchPrompt({
                message,
                pageSize: 12,
                source: async term => {
                    const searchValue = (term || "").trim().toLowerCase();
                    const matchingChunks = normalizedChunkNames.filter(
                        chunkName => !searchValue || chunkName.toLowerCase().includes(searchValue),
                    );

                    return matchingChunks.length
                        ? matchingChunks.map(chunkName => ({
                              name: chunkName,
                              value: chunkName,
                          }))
                        : [
                              {
                                  name: `No resources found for \"${term || ""}\"`,
                                  value: "__no_results__",
                                  disabled: true,
                              },
                          ];
                },
            });
        };

        const askForMoveKeySelection = sourceKeys => {
            const filteredChoices = input => {
                const searchValue = (input || "").trim().toLowerCase();
                return sourceKeys
                    .filter(key => !searchValue || key.toLowerCase().includes(searchValue))
                    .map(key => ({
                        name: key,
                        value: key,
                    }));
            };

            return checkboxPlus({
                message: "Select key(s) to move:",
                searchable: true,
                highlight: true,
                pageSize: 12,
                required: true,
                instructions: "Type to filter, use space to select keys, then press Enter.",
                validate: selectedKeys => (selectedKeys.length ? true : "Select at least one key to move"),
                source: async (_, input) => filteredChoices(input),
            });
        };

        const readChunksAndAsk = () => {
            pathUtility
                .readChunksNames()
                .then(chunkNames => {
                    if (!chunkNames.length) {
                        LogUtility.logErr(`NO RESOURCES FOUND IN ${srcFolder}`);
                        askForRecursiveActions();
                        return;
                    }
                    askForChunkSelection("Select resource: ", chunkNames).then(addScenario);
                })
                .catch(LogUtility.logErr);
        };

        const moveConflictActions = {
            rename: "rename",
            cancel: "cancel",
        };

        const askForMoveTargetKeyName = async (targetChunkName, keyName, reservedTargetKeyNames) => {
            if (!reservedTargetKeyNames.has(keyName)) {
                return keyName;
            }

            LogUtility.logMoveConflict(keyName);

            const { conflictAction } = await inquirer.prompt({
                type: "select",
                name: "conflictAction",
                message: "Choose how to continue:",
                choices: [
                    { name: "Provide a new key name", value: moveConflictActions.rename },
                    { name: "Cancel", value: moveConflictActions.cancel },
                ],
            });

            if (conflictAction === moveConflictActions.cancel) {
                return null;
            }

            const { targetKeyName } = await inquirer.prompt({
                type: "input",
                name: "targetKeyName",
                message: "New key name? ",
                validate: name => {
                    const isValidName = isValidJSName(name);
                    const exists = reservedTargetKeyNames.has(name);

                    if (exists || !isValidName) {
                        return exists ? "This key is already exists" : "Key name isn't valid";
                    }

                    return true;
                },
            });

            return targetKeyName;
        };

        const askForMoveTargetKeyMappings = async (targetChunkName, keyNames) => {
            const targetChunkContent = SrcGenerator.readDefaultLangChunk(targetChunkName);
            const reservedTargetKeyNames = new Set(Object.keys(targetChunkContent));
            const keyMappings = [];

            for (const keyName of keyNames) {
                const targetKeyName = await askForMoveTargetKeyName(targetChunkName, keyName, reservedTargetKeyNames);

                if (!targetKeyName) {
                    return null;
                }

                reservedTargetKeyNames.add(targetKeyName);
                keyMappings.push({
                    sourceKeyName: keyName,
                    targetKeyName,
                });
            }

            return keyMappings;
        };

        const moveScenario = async () => {
            try {
                const chunkNames = (await pathUtility.readChunksNames()) || [];

                if (chunkNames.length < 2) {
                    LogUtility.logErr(`AT LEAST TWO RESOURCES REQUIRED IN ${srcFolder}`);
                    askForRecursiveActions();
                    return;
                }

                const sourceChunkName = await askForChunkSelection("Select source resource: ", chunkNames);
                const sourceChunkContent = SrcGenerator.readDefaultLangChunk(sourceChunkName);
                const sourceKeys = Object.keys(sourceChunkContent);

                if (!sourceKeys.length) {
                    LogUtility.logErr(`NO KEYS FOUND IN ${sourceChunkName}`);
                    askForRecursiveActions();
                    return;
                }

                const keyNames = await askForMoveKeySelection(sourceKeys);

                const targetChunkNames = chunkNames.filter(chunkName => chunkName !== sourceChunkName);
                const targetChunkName = await askForChunkSelection("Select target resource: ", targetChunkNames);
                const keyMappings = await askForMoveTargetKeyMappings(targetChunkName, keyNames);

                if (!keyMappings) {
                    askForRecursiveActions();
                    return;
                }

                await srcGenerator.moveKeys(sourceChunkName, targetChunkName, keyMappings);
                await updateAffectedChunks([sourceChunkName, targetChunkName]);
                LogUtility.logKeysMoveSuccess(keyMappings, targetChunkName);
                askForRecursiveActions();
            } catch (err) {
                LogUtility.logErr(err);
                askForRecursiveActions();
            }
        };

        inquirer
            .prompt(startupQuestions)
            .then(answers => {
                if (answers.action === actions.add) {
                    readChunksAndAsk();
                }

                if (answers.action === actions.move) {
                    moveScenario();
                }

                if (answers.action === actions.create) {
                    createScenario(answers.resxName);
                }

                if (answers.action === actions.regenerateAll) {
                    generateAll();
                }

                if (answers.action === actions.quit) {
                    LogUtility.logQuit();
                    process.exit(0);
                }
            })
            .catch(LogUtility.logErr);
    };

    const cliArgs = process.argv.slice(2);
    const hasMoveMode = cliArgs.includes("-m") || cliArgs.includes("--move");

    program
        .name("resxprocessor")
        .description("Manage JSON localization resources")
        .option("-d, --dogood", "Doing everything GOOD")
        .option("-m, --move", "Move key(s) from one resource file to another")
        .addOption(new Option("-s, --source <file>", "source resource name or file name").hideHelp())
        .addOption(
            new Option("-k, --key <key>", "key name to move; repeat the option or use commas for multiple keys")
                .default([])
                .argParser((value, previousValues) => collectOptionValues(value, previousValues))
                .hideHelp(),
        )
        .addOption(new Option("-t, --target <file>", "target resource name or file name").hideHelp())
        .addOption(
            new Option(
                "-n, --new-key <key>",
                "optional target key name; repeat the option or use commas to map multiple keys by order",
            )
                .default([])
                .argParser((value, previousValues) => collectOptionValues(value, previousValues))
                .hideHelp(),
        )
        .addHelpText("after", cliHelpText);

    program.parse(process.argv);

    const options = program.opts();
    const hasMoveArguments = !!(options.source || options.target || options.key.length || options.newKey.length);

    if (options.move || hasMoveMode) {
        if (options.dogood) {
            LogUtility.logErr("--dogood cannot be used together with --move");
            process.exitCode = 1;
            return;
        }

        runMoveCommand(options);
        return;
    }

    if (hasMoveArguments) {
        LogUtility.logErr("Use --move together with --source, --key, and --target");
        process.exitCode = 1;
        return;
    }

    if (options.dogood) {
        generateAll();
    } else {
        beginInteraction();
    }
};

export default initModule;

// todo: Move all questions to its own utility to make index.js clean and simple for understanding;
