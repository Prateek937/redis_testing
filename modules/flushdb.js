const {run} = require('./run');
const async = require('async');
module.exports.flushall = (nodes, next) => {
    async.eachOf(nodes, (node, nodeName, next) => {
        const command = `redis-cli -h ${node.private_ip} -p ${node.port} flushall`;
        run(command, next);
    }, (err) => {
        if (err) return next(err);
        next(null, 'flushed successfully!');
    });
}