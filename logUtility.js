const colors = require('colors');

class LogUtility {
    static logErr(err) {
        console.log(colors.red(`ERROR: ${err}`));
    }

    static logSuccess() {
        return console.log(colors.green('EVERYTHING IS OK. Enjoy ^_^'));
    }

    static logSection(sectionText) {
        console.log('-----------------------');
        console.log(`${sectionText}`);
        console.log('-----------------------');
    }
}

module.exports = LogUtility;
