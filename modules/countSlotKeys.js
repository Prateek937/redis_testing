const {run} = require('./run');

mmodule.exports.countSlotKey = (node, port, next) => {
    const command = `redis-cli --cluster check ${node}:${port} | grep slaves`;
    run(command, (err, result) => err ? next(err) : next(null, result));
}