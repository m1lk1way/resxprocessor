const fs = require('fs');
const { promisify } = require('util');
const PathUtility = require('./pathUtility');
const fsOptions = require('./fsOptions');

const readFileAsync = promisify(fs.readFile);
const pathUtility = new PathUtility();

class SearchUtility {
    constructor(languages) {
        this.languages = languages;
    }
    // eslint-disable-next-line
    static find(obj, value) {
        return Object.keys(obj).find(key => obj[key] === value);
    }

    static findMatches(obj, value, isRecursive) {
        const searchObj = { ...obj };
        const matches = [];
        
        let match = SearchUtility.find(searchObj, value);

        if (isRecursive) {
            while (match) {
                matches.push(match);
                delete searchObj[match];
                match = SearchUtility.find(searchObj, value);
            }
        }
        return isRecursive ? matches : match;
    }

    search(value, isRecursive = false) {
        const matchesMap = new Map();

        pathUtility.readChunksNames()
            .then(chunks => {
                const chunkOps = chunks.map(c => {
                    const langOps = this.languages.map(l => {
                        const langFilePath = pathUtility.getSrcFilePath(c, l);
                        return readFileAsync(langFilePath, fsOptions.jsonRead)
                            .then(content => {
                                const langObj = JSON.parse(content);
                                const matches = SearchUtility.findMatches(langObj, value, isRecursive);
                                console.log(matches);
                                if (matches) {
                                    if (Array.isArray(matches)) {
                                        matches.forEach(m => {
                                            matchesMap.set(langFilePath, m);
                                        });
                                    }
                                    else {
                                        matchesMap.set(langFilePath, matches);
                                    }
                                }
                            });
                    });

                    return Promise.all(langOps);
                });

                return Promise.all(chunkOps);
            })
            .then(() => {
                console.log(matchesMap);
            });
    }
}

module.exports = SearchUtility;
