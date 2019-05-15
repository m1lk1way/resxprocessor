const fs = require('fs');
const glob = require('glob');
const parser = require('xml2json');

class CoreResxFile {
    /**
     * @param {String} fullPath
     * @param {String} resxRootPath
     */
    constructor(fullPath, resxRootPath) {
        this.fullPath = fullPath;
        this.lang = this.getLang(fullPath.toLowerCase());

        const name = fullPath.substring(resxRootPath.length + 1).toLowerCase();
        this.name = name.replace(`.${this.lang}.`, '.');
    }

    getContent() {
        let resolve,
            reject;

        const promise = new Promise((r, rej) => {
            resolve = r;
            reject = rej;
        });

        if (this.content) {
            resolve(this.content);
        }

        else {
            fs.readFile(this.fullPath, (err, fileContent) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.content = JSON.parse(parser.toJson(fileContent));
                    resolve(this.content);
                }
            });
        }

        return promise;
    }

    async getKeys() {
        const content = await this.getContent();
        return content.root.data.map(x => x.name);
    }

    async getKeyValue(key) {
        const content = await this.getContent();
        const node = content.root.data.find(x => x.name === key);
        return node && node.value;
    }

    /**
     * @param {String} path
     */
    getLang(path) {
        const regex = new RegExp('\\.(\\w\\w)\\.resx$');
        const match = regex.exec(path);
        if (match) {
            return match[1].toLowerCase();
        }
        return 'en';
    }

    toJSON() {
        return this.name;
    }
}

class CoreResxProvider {
    /**
     * @param {String} corePath
     */
    constructor(corePath) {
        this.corePath = corePath.replace(/\/$/, '');
        this.resxProjectPath = `${this.corePath}/LogicSoftware.EasyProjects.Resources`;
    }

    /**
     * @returns {Promise<CoreResxFile[]>}
     */
    readAllFiles() {
        let resolve,
            reject;

        const promise = new Promise((r, rej) => {
            resolve = r;
            reject = rej;
        });

        if (!this.files) {
            glob(`${this.resxProjectPath}/**/*.resx`, null, (err, files) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.files = files.map(f => new CoreResxFile(f, this.resxProjectPath));
                    resolve(this.files);
                }
            });
        }
        else {
            resolve(this.files);
        }
        return promise;
    }

    /**
     * Finds all default (en) resx files.
     * @returns {Promise<CoreResxFile[]>}
     */
    async getResxFiles() {
        const files = await this.readAllFiles();
        return files.filter(x => x.lang === 'en');
    }

    /**
     *
     * @param {String} name
     * @param {String} lang
     */
    async getFile(name, lang = 'en') {
        const files = await this.readAllFiles();
        return files.find(x => x.name === name && x.lang === lang);
    }
}

module.exports = CoreResxProvider;
