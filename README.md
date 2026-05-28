# resxprocessor
[![Build Status](https://travis-ci.org/m1lk1way/resxprocessor.svg?branch=master)](https://travis-ci.org/m1lk1way/resxprocessor)
[![npm downloads](https://img.shields.io/npm/dt/resxprocessor?label=npm%20downloads)](https://www.npmjs.com/package/resxprocessor)

`resxprocessor` is a CLI tool for managing frontend localization resources stored as JSON files.

It helps you:

- create resource files for all configured languages
- keep language files in sync with the default language
- remove outdated keys from localized JSON files
- generate dist resources from source JSON files (`[name].[lang].js`)
- add new keys to existing resources
- move one or multiple keys between resource files
- move a key directly from the command line without interactive prompts

## Features added in the current branch

- interactive **Move keys to another resource file** flow
- support for moving **multiple keys at once**
- conflict handling when the target resource already contains a key
- atomic move operation with rollback on failure
- synchronized move across all configured language files
- searchable resource selection in interactive prompts
- searchable multi-select for key selection
- `Esc` support to go back to the previous interactive step

## Dependencies used by the CLI

- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - interactive CLI prompts
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js/) - searchable prompt components
- [inquirer-checkbox-plus-plus](https://www.npmjs.com/package/inquirer-checkbox-plus-plus) - searchable multi-select prompt
- [commander.js](https://github.com/tj/commander.js/) - CLI argument parsing
- [colors.js](https://github.com/Marak/colors.js) - terminal colors

## Requirements

`resxprocessor` requires [Node.js](https://nodejs.org/) **v18+**.

## Installation

```sh
npm install resxprocessor -g
```

## Configuration

Create a `.resxprocessor` file in the same folder where you run the CLI.

### Configuration keys

```json
{
  "tabSize": 4,
  "srcFolder": "./resxSrc/",
  "distFolder": "./resxDist/",
  "resxPrefix": "Resx",
  "jsNamespace": "ep.resources",
  "languages": ["en", "ru", "de", "fr"],
  "defaultLang": "en",
  "currentLangNS": "ep.resxCulture"
}
```

Field description:

- `tabSize` - indentation size used for generated JSON
- `srcFolder` - folder with source JSON files
- `distFolder` - folder for generated JS resources
- `resxPrefix` - suffix/prefix part used in generated dist filenames
- `jsNamespace` - namespace used for generated dist resources
- `languages` - list of supported languages
- `defaultLang` - default language used as the source of truth
- `currentLangNS` - namespace that contains the current UI language

## Usage

Run the CLI from the same directory where `.resxprocessor` is located.

### Main CLI modes

The top-level CLI modes are:

- `--dogood`, `-d` - regenerate, sanitize, and sort all resources
- `--move`, `-m` - move one or more keys between resource files without interactive prompts
- `--help`, `-h` - show CLI help

### Interactive mode

```sh
resxprocessor
```

Available interactive actions:

- `Do everything GOOD`
- `Create new resx`
- `Add keys to existing one`
- `Move keys to another resource file`
- `Quit`

### Interactive UX details

- resource selection supports search
- key selection in move flow supports search and multi-select
- press `Esc` to return to the previous step in supported prompts

### Move keys flow

The move flow allows you to:

1. select a source resource file
2. search and select one or more keys
3. select a target resource file
4. rename conflicting keys or cancel the move
5. move values across all configured language JSON files in sync

On success the CLI regenerates the affected source/dist outputs and prints a success message.

### Direct move command

You can also move keys without entering interactive mode by using `--move` (or `-m`):

```sh
resxprocessor --move --source common --key saveButton --target calendar
```

Move multiple keys at once:

```sh
resxprocessor -m -s common -k saveButton -k cancelButton -t calendar
```

You can also pass multiple keys as a comma-separated list:

```sh
resxprocessor -m -s common -k saveButton,cancelButton -t calendar
```

Rename while moving. When multiple keys are provided, `--new-key` values are matched by order:

```sh
resxprocessor -m -s common -k saveButton -k cancelButton -t calendar -n calendarSaveButton -n calendarCancelButton
```

Supported arguments:

- `--move`, `-m` - run direct move mode
- `--source`, `-s` - source resource name or file name (for example `common` or `common.en.json`)
- `--key`, `-k` - key name to move; repeat the option or pass a comma-separated list for multiple keys
- `--target`, `-t` - target resource name or file name
- `--new-key`, `-n` - optional target key name; repeat the option or pass a comma-separated list to rename multiple keys by order

Notes:

- `--source`, `--key`, and `--target` are used together with `--move`
- `--new-key` is optional
- `--dogood` and `--move` are separate modes and should not be combined in one command

The command moves all specified keys across configured language files, regenerates affected outputs, and fails safely if the move cannot be completed.

Show CLI help:

```sh
resxprocessor --help
```

### Batch regenerate mode

```sh
resxprocessor -d
```

This mode regenerates, sanitizes and sorts the existing src/dist files based on the current resource set.

## Development

Install dependencies:

```sh
npm install
```

Useful scripts:

```sh
npm run lint
npm run prettier
npm run start
```

## License

MIT

