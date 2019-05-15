const fs = require('fs');
const DistGenerator = require('../generators/distGenerator');
const SrcGenerator = require('../generators/srcGenerator');
const PathUtility = require('../utils/pathUtility');
const Markup = require('../utils/markupUtility');

const cfgPath = `${process.cwd()}/.resxprocessor`;

const configure = () => {
    const config = fs.readFileSync(cfgPath, { encoding: 'utf8' });
    
    const {
        tabSize, srcFolder, distFolder, resxPrefix, jsNamespace, languages, defaultLang, currentLangNS,
    } = JSON.parse(config);

    const pathUtility = new PathUtility();
    pathUtility.init(srcFolder, distFolder, defaultLang, resxPrefix);

    const markupUtility = new Markup();
    markupUtility.init(tabSize);

    const srcGenerator = new SrcGenerator(languages, defaultLang, srcFolder);
    srcGenerator.init(languages, defaultLang, srcFolder);

    const distGenerator = new DistGenerator(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS);
    distGenerator.init(jsNamespace, languages, defaultLang, resxPrefix, srcFolder, currentLangNS);
};


module.exports = configure;
