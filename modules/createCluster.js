const {run} = require('./run');

module.exports.createCluster = (nodes, next) => {
    const command = `redis-cli --cluster create ${nodes.node1.ip}:${nodes.node1.port} ${nodes.node2.ip}:${nodes.node2.port} ${nodes.node3.ip}:${nodes.node3.port} --cluster-replicas 0 --cluster-yes | grep OK`;
    run(command, (err, result) => {
        if (err) return next(err);
        next(null, result)
    });
}
