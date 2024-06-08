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

module.exports.applyCommand = (command, args, next) => {
    const out = spawn(command, args);
    out.stdout.on('data', data => console.log(`${data}`));
    out.stderr.on('data', data => console.log(`${data}`));
    out.on('close', code => (code == 0) ? next(undefined) : next(new Error(`child process exited with code ${code}`)));
}