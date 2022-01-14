const {hashElement} = require('folder-hash');


const calcDirHash = dir => new Promise((resolve, reject) => {
    const options = {
        algo: 'sha256',
        encoding: 'hex',
        folders: {exclude: ['.git', '.github']},
        files: {exclude: ['.gitignore', 'folder-checksum-sha256.txt']}
    };
    hashElement(dir, options)
        .then(hash => resolve(hash.hash))
        .catch(error => reject(error));
});

const calcDirHashSync = async dir => await calcDirHash(dir);

module.exports = {calcDirHash, calcDirHashSync};
