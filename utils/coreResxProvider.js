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

        let name = fullPath.substring(resxRootPath.length + 1).toLowerCase();
        this.name = name.replace(`.${this.lang}.`, ".");
    }

    getContent() {
        let resolve, reject;
        let promise = new Promise((r, rej) => {
            resolve = r;
            reject = rej;
        });

        if(this._content) {
            resolve(this._content);
        }else {
            fs.readFile(this.fullPath, (err, fileContent) => {
                if(err) {
                    reject(err);
                } else {
                    this._content = JSON.parse(parser.toJson(fileContent));
                    resolve(this._content);
                }
            });
        }

        return promise;
    }

    async getKeys() {
        let content = await this.getContent();
        return content.root.data.map(x => x.name);
    }

    async getKeyValue(key) {
        let content = await this.getContent();
        let node = content.root.data.find(x => x.name === key);
        return node && node.value;
    }

    /**
     * @param {String} path 
     */
    getLang(path) {
        let regex = new RegExp(`\\.(\\w\\w)\\.resx$`)
        let match = regex.exec(path);
        if(match) {
            return match[1].toLowerCase();
        }
        return "en";
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
        this.corePath = corePath.replace(/\/$/, "");
        this.resxProjectPath = `${this.corePath}/LogicSoftware.EasyProjects.Resources`;
    }
    
    /**
     * @returns {Promise<CoreResxFile[]>}
     */
    readAllFiles()  {
        let resolve, reject;
        let promise = new Promise((r, rej) => {
            resolve = r;
            reject = rej;
        });

        if(!this.files) {
            glob(`${this.resxProjectPath}/**/*.resx`, null, (err, files) => {
                if(err){
                    reject(err);
                }else {
                    this.files = files.map(f => new CoreResxFile(f, this.resxProjectPath));
                    resolve(this.files);
                }
            });
        } else {
            resolve(this.files);
        }
        return promise;
    }

    /**
     * Finds all default (en) resx files.
     * @returns {Promise<CoreResxFile[]>}
     */
    async getResxFiles() {
        let files = await this.readAllFiles();
        return files.filter(x => x.lang === "en");
    }

    /**
     * 
     * @param {String} name 
     * @param {String} lang 
     */
    async getFile(name, lang = "en") {
        let files = await this.readAllFiles();
        return files.find(x => x.name === name && x.lang === lang);
    }
}

module.exports = CoreResxProvider;