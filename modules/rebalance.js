const {run} = require('./run');

module.exports.rebalanceCluster = (node, port, next) => {
    const command = `redis-cli --cluster rebalance ${node}:${port} --cluster-use-empty-masters`;
    run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("Rebalancing")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
    });
}
