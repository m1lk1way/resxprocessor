const configureGenerators = require('../../../utils/configUtility');
const SrcGenerator = require('../../../generators/srcGenerator');
const PathUtility = require('../../../utils/pathUtility');

configureGenerators();
const srcGenerator = new SrcGenerator();
const pathUtility = new PathUtility();

const getAllChunks = (req, res) => {
    srcGenerator.readChunksNames()
        .then(chunkNames => {
            res.json({ chunkNames });
        });
};

const getChunk = (req, res) => {
    const { chunkName } = req.params;
    const exists = SrcGenerator.checkChunkExistance(chunkName);

    if (!exists) {
        res.json({ error: 'Obj Not Found' });
    }
    else {
        srcGenerator.readAllChunkData(chunkName)
            .then(chunkData => {
                const processedData = chunkData.reduce((acc, v) => {
                    
                    const lang = Object.keys(v);
                    acc[lang] = v[lang];
                    console.log(acc);
                    return acc;
                    
                }, {});
                res.json(processedData);
            });
    }
};

const getLanguages = (req, res) => {
    const { languages } = pathUtility.readConfig();
    return res.json(languages);
};

module.exports = {
    getLanguages,
    getAllChunks,
    getChunk,
};
