class SortUtility {
    static sort(obj) {
        const sortedObj = Object.keys(obj)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .reduce((acc, key) => {
                acc[key] = obj[key];
                return acc;
            }, {});

        return sortedObj;
    }

    static getSortedKeys(obj) {
        return Object.keys(SortUtility.sort(obj));
    }
}

module.exports = SortUtility;
