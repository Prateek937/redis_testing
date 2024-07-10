const shell = require('./shell');
const async = require('async');

const float = function(...args) {
    const next = args.pop();
	return function(err, ...results) { if (err) return next(err);
		next(null, ...args, ...results);
	}
};

module.exports.check = (node, next) => {
    console.log(`### CHECK NODE ${node.host}:${node.port} ###\n`);
    const command = `redis-cli --cluster check ${node.host}:${node.port} | grep keys | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    shell.run(command, (err, result) => err ? next(err) : next(null, result));
}

module.exports.countSlots = (node, next) => {
    async.waterfall([
        next => shell.run(`redis-cli -h ${node.host} -p ${node.port} CLUSTER NODES | grep "${node.host}:${node.port}" | awk '{print $1}'`, next),
        (nodeId, next) => shell.run(`redis-cli -h ${node.host} -p ${node.port} CLUSTER NODES | grep "${nodeId}" | awk '{print $9}'`, next),
        (slotRange, next) => {
            let slots = slotRange.split('-');
            next(null, parseInt(slots[1]) - parseInt(slots[0]) + 1);
        }
    ], next);
}

module.exports.countNodes = (node, next) => {
    async.waterfall([
        next => shell.run(`redis-cli -h ${node.host} -p ${node.port} CLUSTER NODES | wc -l`, next),
        (result, next) => next(null, parseInt(result.trim()))
    ], next)
}

module.exports.createCluster = (nodes, next) => {
    let clusterNodes = '';
    nodes.forEach(node => clusterNodes += ` ${node.host}:${node.port}`); // creating a space separated list of nodes
    console.log(`### CREATING CLUSTER OF 3 NODES ${clusterNodes} ###\n`);
    const command = `redis-cli --cluster create ${clusterNodes} --cluster-replicas 0 --cluster-yes | grep OK | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    console.log(command);
    shell.run(command, (err, result) => {
        if (err) return next(err);
        if (result.includes('All nodes agree')) return next(null, 'cluster created successfully');
        next(null, result);
    });
}

module.exports.flushall = (nodes, next) => {
    console.log(`### FLUSHING DATABASE : ${node.host}:${node.port} ###\n`);
    async.eachOf(nodes, (node, nodeName, next) => {
        const command = `redis-cli -h ${node.host} -p ${node.port} flushall`;
        console.log(command);
        shell.run(command, next);
    }, (err) => {
        if (err) return next(err);
        next(null, 'flushed successfully!');
    });
}

module.exports.addMaster = (clusterNode, nodeToAdd, next) => {
    console.log(`### ADDING ${node.host}:${node.port} NODE TO CLUSTER ###\n`);
    const command = `redis-cli --cluster add-node ${nodeToAdd.host}:${nodeToAdd.port} ${clusterNode.host}:${clusterNode.port} | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    console.log(command);
    shell.run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("added")) return next(null, `node added successfully`);
            // if (line.includes("added")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
        // next(null, result)
    });
}

module.exports.rebalance = (node, next) => {
    console.log(`### REBALANCING CLUSTER ON ${node.host}:${node.port} ###\n`);
    const command = `redis-cli --cluster rebalance ${node.host}${node.port} --cluster-use-empty-masters`;
    console.log(command)
    shell.run(command, (err, result) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("Rebalancing")) return next(null, 'rebalanced successfully!');
            if (line.includes("No rebalancing needed!")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
    });
}

module.exports.removeMaster = (node, next) => {
    console.log(`### REMOVING ${node.host}:${node.port} FROM CLUSTER ###\n`);
    const nodeIdCommand = `redis-cli -h ${node.host} -p ${node.port} CLUSTER MYID`;
    async.waterfall([
        next => shell.run(nodeIdCommand, (err, result) =>err ? next(err) : next(null, result.trim())),
        (nodeId, next) => {
            // const resultCommand = `redis-cli -h ${node} -p ${port} cluster forget ${nodeId}`;
            const resultCommand = `redis-cli --cluster del-node ${node.host}:${node.port} ${nodeId}`;
            console.log(command)
            shell.run(resultCommand, (err, result) => err ? next(err) : next(null, result.trim()));
        }
    ],  (err, result) => {
        if(err) return next(err);
        // next(null, `removed successfully!`);
        next(null, result.split('>>> ').join('').trim('\n'));
    });
}

module.exports.reshard = (nodeTo, nodeFrom, slots, next) => {
    console.log(`### RESHARDING FROM ${nodeFrom.host} TO ${nodeTo.host} ###\n`);
    const clusterToIdCommand = `redis-cli -h ${nodeTo.host} -p ${nodeTo.port} CLUSTER NODES | grep myself | cut -d" " -f1`;
    const clusterFromIdCommand = `redis-cli -h ${nodeFrom.port} -p ${nodeFrom.port} CLUSTER NODES | grep myself | cut -d" " -f1`;

    async.waterfall([
        next => shell.run(clusterToIdCommand, (err, result) => err ? next(err) : next(null, result.trim())),
        (clusterToId, next) => shell.run(clusterFromIdCommand, float(clusterToId, next)),
        (clusterToId, clusterFromId, next) => {
            const finalCommand = `redis-cli --cluster reshard ${nodeFrom.host}:${nodeFrom.port} --cluster-from ${clusterFromId.trim()} --cluster-to ${clusterToId.trim()} --cluster-slots ${slots} --cluster-yes | grep Ready`;
            shell.run(finalCommand, (err, result) => err ? next(err) : next(null, 'resharded successfully!'));
        }
    ], next);
}

module.exports.writeKeys = (clusterNodes, keyCount, startTime, next) => {
    console.log(`### WRITING ${keys} KEYS ###\n`);
    const cluster = new Redis.Cluster(clusterNodes);
    const atOnce = keyCount < 1000000 ? keyCount : 1000000
    async.timesSeries(keyCount/atOnce, (i, next) => 
        async.times(atOnce, (j, next) => {
            let key   = `${startTime}${j+i*atOnce}`;
            let value = `${startTime}${j+i*atOnce}`;
            cluster.set(key, value, (err, result) => {
                if (err) {
                console.error(`Error setting ${key}:`, err);
                return next(err);
                }
                // console.log(`${key} set successfully:`, result);
                next(null, result);
            })
        }, (err, result) => {
            next(err, `${i}M keys written successfully!`)
    }), (err, result) => {
        cluster.quit();
        next(err, `${keyCount/1000000}M keys written successfully!`)
    });
}

