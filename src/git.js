const fetch = require('node-fetch');
const nodegit = require('nodegit');

class Git {
    constructor (repository, locale) {
        this._repository = repository;

        const {owner, name} = this.normalize(this._repository);
        if (locale === 'zh-cn') {
            this._url = `https://gitee.com/openblockcc/external-resources`;
            this._releasesUrl = `https://gitee.com/api/v5/repos/${owner}/${name}/releases/latest`;
        } else {
            this._url = `https://github.com/openblockcc/external-resources`;
            this._releasesUrl = `https://api.github.com/repos/${owner}/${name}/releases/latest`;
        }
    }

    normalize (repo) {
        let regex = /^(?:(direct):([^#]+)(?:#(.+))?)$/;
        let match = regex.exec(repo);
        let checkout;

        if (match) {
            const url = match[2];
            checkout = match[3] || 'main';

            return {
                type: 'direct',
                url: url,
                checkout: checkout
            };
        }
        regex = /^(?:(github|gitlab|bitbucket|gitee):)?(?:(.+):)?([^/]+)\/([^#]+)(?:#(.+))?$/;
        match = regex.exec(repo);
        const type = match[1] || 'github';
        let origin = match[2] || null;
        const owner = match[3];
        const name = match[4];
        checkout = match[5] || 'master';

        if (origin === null) {
            if (type === 'github') {
                origin = 'github.com';
            } else if (type === 'gitee') {
                origin = 'gitee.com';
            } else if (type === 'gitlab') {
                origin = 'gitlab.com';
            } else if (type === 'bitbucket') {
                origin = 'bitbucket.com';
            }
        }

        return {
            type: type,
            origin: origin,
            owner: owner,
            name: name,
            checkout: checkout
        };

    }

    getLatestReleases () {
        return new Promise((resolve, reject) => {
            fetch(this._releasesUrl)
                .then(response => response.json())
                .then(info => {
                    this._tagName = info.tag_name;
                    return resolve({version: info.tag_name, body: info.body});
                })
                .catch(err => reject(`Error while getting latest release from: ${this._url}: ${err}`));
        });
    }

    cloneLatestReleases (dir) {
        return new Promise((resolve, reject) => {
            nodegit.Clone.clone(this._url, dir, {ignoreCertErrors: 1})
                .then(repo => repo.getReferenceCommit(this._tagName).then(tag => ({tag: tag, repo: repo})))
                .then(current => nodegit.Checkout.tree(current.repo, current.tag,
                    {checkoutStrategy: nodegit.Checkout.STRATEGY.SAFE_CREATE}).then(() => resolve()))
                .catch(err => {
                    reject(`Error while cloneing latest release from: ${this._url}: ${err}`);
                });
        });
    }
}

module.exports = Git;
