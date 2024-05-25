const { execSync, exec} = require('child_process');

module.exports.runSync = (command) => {
    try {
        const result = execSync(command).toString();
        return result;
    } catch (error) {
        return new Error(`ERROR >>> ${error.message}`);
    }
}

module.exports.run = (command, next) => exec(command, (err, stdout, stderr) => {
    if (stderr) return next(stderr);
    next(null, stdout);
})



module.exports.run('redis-cli info', (err, result) => {
    console.log({err, result});
})