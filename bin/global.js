#!/usr/bin/env node
const fs = require('fs');
const initModule = require('../index.js');

const cfgPath = `${process.cwd()}/.generator`;
fs.readFile(cfgPath, { encoding: 'utf8' }, (err, data) => {
    if (err) throw err;
    const config = JSON.parse(data);
    initModule(config);
});
