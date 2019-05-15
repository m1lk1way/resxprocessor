const resourcesManager = require('../controllers');

const appRoutes = app => {
    app.route('/languages')
        .get(resourcesManager.getLanguages);
    app.route('/chunks')
        .get(resourcesManager.getAllChunks);
    app.route('/chunks/:chunkName')
        .get(resourcesManager.getChunk);
};

module.exports = appRoutes;
