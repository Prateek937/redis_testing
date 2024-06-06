const {run} = require('./run');

module.exports.addMaster = (clusterNode, nodeToAdd, next) => {
    const command = `redis-cli --cluster add-node ${nodeToAdd.ip}:${nodeToAdd.port} ${clusterNode.ip}:${clusterNode.port}`;
    run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("added")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
    });
}