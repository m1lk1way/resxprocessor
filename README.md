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

