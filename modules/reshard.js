const {run} = require('./run');
const {waterfall} = require('async');

const float = function(...args) {
    const next = args.pop();
	return function(err, ...results) { if (err) return next(err);
		next(null, ...args, ...results);
	}
};

module.exports.reshard = (reshardTo, reshardFrom, next) => {
    const clusterToIdCommand = `redis-cli -h ${reshardTo.private_ip} -p ${reshardTo.port} CLUSTER NODES | grep myself | cut -d" " -f1`;
    const clusterFromIdCommand = `redis-cli -h ${reshardFrom.private_ip} -p ${reshardFrom.port} CLUSTER NODES | grep myself | cut -d" " -f1`;

    waterfall([
        next => run(clusterToIdCommand, (err, result) => err ? next(err) : next(null, result.trim())),
        (clusterToId, next) => run(clusterFromIdCommand, float(clusterToId, next)),
        (clusterToId, clusterFromId, next) => {
            const finalCommand = `redis-cli --cluster reshard ${reshardFrom.private_ip}:${reshardFrom.port} --cluster-from ${clusterFromId.trim()} --cluster-to ${clusterToId} --cluster-slots 4096 --cluster-yes | grep Ready`;
            run(finalCommand, (err, result) => err ? next(err) : next(null, 'resharded successfully!'));
        }
    ], next);
}