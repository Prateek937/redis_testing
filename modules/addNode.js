const {run} = require('./run');

module.exports.addMaster = (clusterNode, nodeToAdd, next) => {
    const command = `redis-cli --cluster add-node ${nodeToAdd.private_ip}:${nodeToAdd.port} ${clusterNode.private_ip}:${clusterNode.port} | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        // for (let line of lines) {
        //     // if (line.includes("added")) return next(null, `added node successfully`);
        //     if (line.includes("added")) return next(null, line);
        // }
        // next(`ERROR >>> ${result}`);
        next(null, result)
    });
}