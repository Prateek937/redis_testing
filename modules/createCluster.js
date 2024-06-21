const {run} = require('./run');

module.exports.createCluster = (nodes, next) => {
    let members = '';

    for (const key in nodes) {
        let node = nodes[key];
        members += `${node.private_ip}:${node.port} `;
    }

    const command = `redis-cli --cluster create ${members.trim()} --cluster-replicas 0 --cluster-yes | grep OK | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    run(command, (err, result) => {
        if (err) return next(err);
        if (result.includes('All nodes agree')) return next(null, 'cluster created successfully');
        next(null, result);
    });
}
