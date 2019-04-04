const colors = require('colors');

class LogUtility {
    static logErr(err) {
        console.log(colors.red(`ERROR: ${err}`));
    }
    
    static logLine() {
        console.log('-----------------------');
    }
    
    static logSrcCreation(filePath) {
        console.log(colors.yellow(`did'n find src file ${colors.white(filePath)} =-> created`));
    }

    static logSuccess() {
        console.log(colors.green('-----------------------'));
        console.log(colors.green('EVERYTHING IS OK. Enjoy ^_^'));
        console.log(colors.green('-----------------------'));
    }

    static logSection(sectionText) {
        console.log('-----------------------');
        console.log(`${sectionText}`);
        console.log('-----------------------');
    }

    static logChunkOperation(chunkName, chunkType, operation) {
        LogUtility.logSection(`${chunkType} chunk ${colors.green(chunkName)} was ${colors.green(operation)}`);
    }

    static logFileUpdate(file) {
        console.log(colors.yellow(`${file} - file was updated`));
    }
    
    static logKeyAdd(key, file) {
        console.log(`added key ${colors.yellow(key)} to ${file}`);
    }

    static logKeyDelete(key) {
        console.log(colors.red(`${key} - key was deleted`));
    }
}

module.exports = LogUtility;
