const {run} = require('./run');

module.exports.countSlotKey = (node, port, next) => {
    const command = `redis-cli --cluster check ${node}:${port} | grep keys | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    run(command, (err, result) => err ? next(err) : next(null, result));
}