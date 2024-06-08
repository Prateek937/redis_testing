const {run} = require('./run');

module.exports.flushall = (nodes, next) => {
    async.forEach(nodes, (node, nodeName, next) => {
        const command = `redis-cli -h ${node} -p ${port} flushall`;
        run(command, next);
    }, next);
}