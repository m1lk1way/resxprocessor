const endcoding = 'utf8';

const fsOptions = {
    write: { flag: 'w', mode: 666, endcoding },
    jsonRead: { endcoding },
};

module.exports = fsOptions;
