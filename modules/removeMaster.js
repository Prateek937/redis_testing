const {run} = require('./run');
const {waterfall} = require('async');

module.exports.removeMaster = (node, port, next) => {
    const nodeIdCommand = `redis-cli -h ${node} -p ${port} CLUSTER NODES | grep myself | cut -d" " -f1`;
    waterfall([
        next => run(nodeIdCommand, (err, result) =>err ? next(err) : next(null, result.trim())),
        (nodeId, next) => {
            // const resultCommand = `redis-cli -h ${node} -p ${port} cluster forget ${nodeId}`;
            const resultCommand = `redis-cli --cluster del-node ${node}:${port} ${nodeId}`
            run(resultCommand, (err, result) => err ? next(err) : next(null, result.trim()));
        }
    ], next);
}
