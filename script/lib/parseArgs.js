const parseArgs = () => {
    const scriptArgs = process.argv.slice(2);

    let dir;
    let version;
    let repo;
    let plat;
    let cdn;

    for (const arg of scriptArgs) {
        const dirSplit = arg.split(/--dir(\s+|=)/);
        if (dirSplit[1] === '=') {
            dir = dirSplit[2];
        }
        const versionSplit = arg.split(/--version(\s+|=)/);
        if (versionSplit[1] === '=') {
            version = versionSplit[2];
        }
        const repoSplit = arg.split(/--repo(\s+|=)/);
        if (repoSplit[1] === '=') {
            repo = repoSplit[2];
        }
        const platSplit = arg.split(/--plat(\s+|=)/);
        if (platSplit[1] === '=') {
            plat = platSplit[2];
        }
        const cdnSplit = arg.split(/--cdn(\s+|=)/);
        if (cdnSplit[1] === '=') {
            cdn = cdnSplit[2];
        }
    }
    return {dir, version, repo, plat, cdn};
};

module.exports = parseArgs;
