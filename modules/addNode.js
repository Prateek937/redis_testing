const {run} = require('./run');

module.exports.addMaster = (node1, port1, node2, port2, next) => {
    const command = `redis-cli --cluster add-node ${node2}:${port2} ${node1}:${port1}`;
    run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("added")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
    });
}