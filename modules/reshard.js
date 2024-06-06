const {run} = require('./run');
const {waterfall} = require('async');

const float = function(...args) {
    const next = args.pop();
	return function(err, ...results) { if (err) return next(err);
		next(null, ...args, ...results);
	}
};

module.exports.reshard = (clusterNode, lastNode, next) => {
    const clusterToIdCommand = `redis-cli -h ${clusterNode.ip} -p ${clusterNode.port} CLUSTER NODES | grep myself | cut -d" " -f1`;
    const clusterFromIdCommand = `redis-cli -h ${lastNode.ip} -p ${lastNode.port} CLUSTER NODES | grep myself | cut -d" " -f1`;

    waterfall([
        next => run(clusterToIdCommand, (err, result) => err ? next(err) : next(null, result.trim())),
        (clusterToId, next) => run(clusterFromIdCommand, float(clusterToId, next)),
        (clusterToId, clusterFromId, next) => {
            const finalCommand = `redis-cli --cluster reshard ${lastNode.ip}:${lastNode.port} --cluster-from ${clusterFromId.trim()} --cluster-to ${clusterToId} --cluster-slots 4096 --cluster-yes | grep Ready`;
            run(finalCommand, (err, result) => err ? next(err) : next(null, result.trim()))
        }
    ], next);
}