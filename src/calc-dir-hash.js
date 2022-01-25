const {hashElement} = require('folder-hash');
const crypto = require('crypto');


const calcDirHash = dir => new Promise((resolve, reject) => {
    const options = {
        algo: 'sha256',
        encoding: 'hex',
        folders: {exclude: ['.git', '.github']},
        files: {exclude: ['.gitignore', 'folder-checksum-sha256.txt']}
    };
    hashElement(dir, options)
        .then(hash => resolve(
            crypto.createHash('sha256')
                .update(hash.children.toString())
                .digest('hex')
        ))
        .catch(error => reject(error));
});


const checkDirHash = (dir, hash) =>
    calcDirHash(dir)
        .then(h => {
            if (h === hash) {
                return Promise.resolve();
            }
            return Promise.reject(`${dir} has failed the folder checksum detection`);

        });

module.exports = {calcDirHash, checkDirHash};
