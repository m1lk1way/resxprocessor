#!/usr/bin/env node
import fs from "fs";
import initModule from "../index.js";

const cfgPath = `${process.cwd()}/.resxprocessor`;
fs.readFile(cfgPath, { encoding: "utf8" }, (err, data) => {
    if (err) throw err;

    const config = JSON.parse(data);
    initModule(config);
});
