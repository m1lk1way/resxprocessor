import "colors";

class LogUtility {
    static logErr(err) {
        console.log(`ERROR: ${err}`.red);
    }

    static logLine() {
        console.log("-----------------------");
    }

    static logSrcCreation(filePath) {
        console.log(`did'n find src file ${filePath.white} =-> created`.yellow);
    }

    static logSuccess() {
        console.log("-----------------------".green);
        console.log("EVERYTHING IS OK. Enjoy ^_^".green);
        console.log("-----------------------".green);
    }

    static logSection(sectionText) {
        console.log("-----------------------");
        console.log(`${sectionText}`);
        console.log("-----------------------");
    }

    static logChunkOperation(chunkName, chunkType, operation) {
        LogUtility.logSection(`${chunkType} chunk ${chunkName.green} was ${operation.green}`);
    }

    static logFileUpdate(file) {
        console.log(`${file} - file was updated`.yellow);
    }

    static logKeyAdd(key, file) {
        console.log(`added key ${key.yellow} to ${file}`);
    }

    static logKeyDelete(key) {
        console.log(`${key} - key was deleted`.red);
    }
}

export default LogUtility;
