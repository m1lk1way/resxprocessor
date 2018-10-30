# resxprocessor
[![Build Status](https://travis-ci.org/m1lk1way/jsonResxGenerator.svg?branch=master)](https://travis-ci.org/m1lk1way/jsonResxGenerator)
This package offers you:
  - Create .json language source files by given languages (through configuration .resxprocessor)
  - Generate .json source files for languages with not specified resources (inherits resources from default language)
  - Remove outdated keys from .json source files (keys which does not exists in main lang file anymore)
  - Generate dist resources output based on sources ([name].[lang].js)
  - Generate TypeScript defenitions for generated resources

**resxprocessor** uses a number of open source projects to work properly:

* [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) - A collection of common interactive command line user interfaces.
* [commander.js](https://github.com/tj/commander.js/) - node.js command-line interfaces made easy.
* [colors.js](https://github.com/Marak/colors.js) - get colors in your node.js console.

### Installation
**resxprocessor** requires [Node.js](https://nodejs.org/) v6+ to run.
```sh
$ npm install resxprocessor -g
```
### Configuration
* Create config file at the very same folder as you going to use this package.
* Give it a name ``.resxprocessor``

    #### Configuration keys:
    ```
        "tabSize" - indent config (number of spaces in one tab)
        "srcFolder" - folder to store/process src (.json) files  
        "distFolder" - folder to store/process dist (.js) files  
        "resxPrefix" - this prefix will be added to dist files names (like test[Prefix].[language].js)
        "jsNamespace" - namespace for generated dist resources (generated obj will be applied to this namespace)
        "tsGlobInterface" - name for global Interface (this interface will be extended with generated resx),
        "languages" - list of languages to work with
    ```
    #### Configuration example:
    ```
    {
        "tabSize" : "4",
        "srcFolder" : "./resxSrc/",
        "distFolder" : "./resxDist/",
        "resxPrefix" : "Resx",
        "jsNamespace" : "ep.resources",
        "tsGlobInterface" : "EPResources",
        "languages" : [ "en", "ru", "de", "fr", "es", "it", "pl", "sk", "tr"]
    }
    ```
### Usage
   Be sure you run it on the same lavel as your config (.resxprocessor) is luying on.
   * To use it in interactive mode execute:
   ``$ npm resxprocessor``
    *To use it like "DO EVERYTHING GOOD" execute:
    ``$ npm resxprocessor -d``
   
   
License
----

MIT

