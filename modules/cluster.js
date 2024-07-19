const shell = require('./shell');
const async = require('async');
const Redis = require('ioredis');
const chalk = require('chalk');
const nodes = require('../inventory');
const preCheck = true;
// import chalk from 'chalk';

const float = function(...args) {
    const next = args.pop();
	return function(err, ...results) { if (err) return next(err);
		next(null, ...args, ...results);
	}
};

const logCommand = (text) => console.log(`\x1b[33m${text}\x1b[0m`);

module.exports.check = (node, next) => {
    let log = `\x1b[33m### CHECK NODE ${node.host}:${node.port} ###\n\x1b[0m`
    // logCommand(`### CHECK NODE ${node.host}:${node.port} ###\n`);
    const command = `redis-cli --cluster check ${node.host}:${node.port} | grep keys | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    shell.run(command, (err, result) => err ? next(log + err) : next(null, log + result));
}

const assert = (flush, keys, nodes, check1, check2) => {
    let keys1 = parseInt(check1.split("\n").slice(-3)[0].split(' ').slice(-5)[0]);
    let keys2 = parseInt(check2.split("\n").slice(-3)[0].split(' ').slice(-5)[0]);
    let nodes1 = parseInt(check1.split("\n").slice(-3)[0].split(' ').slice(-2)[0])
    let nodes2 = parseInt(check2.split("\n").slice(-3)[0].split(' ').slice(-2)[0])
    let slots1 = 0;
    let slots2 = 0;
    check1.split("\n").slice(1, -3).forEach(node => slots1 += parseInt(node.split(' ').slice(-5)[0]));
    check2.split("\n").slice(1, -3).forEach(node => slots2 += parseInt(node.split(' ').slice(-5)[0]));
    if ((!flush && keys2 - keys1 != keys) || slots2 - slots1 != 0 || nodes2 - nodes1 != nodes) {
        console.log(chalk.red("assertion error.\n"), {keys1, keys2, keys, slots1, slots2, nodes1, nodes2, nodes});
        console.log("precheck: \n", check1);
    } else {
        console.log("assertion success.");
    }
    console.log("postcheck: \n", check2, `\ntotal slots: ${slots2}`);
}

const checker = (command, handler, flush, nodeChange, delay, next) => {
    async.waterfall([
        next => {
            if (preCheck) return module.exports.check(nodes[0], next);
            next(null, undefined);
        },
        (check1, next) => shell.run(command, (err, result) => {
            handler(err, result, float(check1, next));
        }),
        (check1, output, next) => {
            if (delay) setTimeout(() => {
                module.exports.check(nodes[0], float(check1, output, next));
            }, delay); 
            else module.exports.check(nodes[0], float(check1, output, next));
        },
        (check1, output, check2, next) => {
            if (check1) assert(flush, 0, nodeChange, check1, check2);
            next(null, output);
        }

    ], next);
} 

module.exports.getSlots = (node, next) => {
    const redis = new Redis.Cluster([
        {
          host: node.host,
          port: node.port
        },
        // Add more nodes if necessary
      ]);
      const slotDistribution = {};
      async function getSlotDistribution() {
        try {
          const slots = await redis.cluster('slots');
      
          slots.forEach(slotRange => {
            const startSlot = slotRange[0];
            const endSlot = slotRange[1];
            const nodeInfo = slotRange[2];
            const nodeIp = nodeInfo[0];
            const nodePort = nodeInfo[1];
            const nodeId = `${nodeIp}:${nodePort}`;
      
            const slotCount = endSlot - startSlot + 1;
      
            if (!slotDistribution[nodeId]) {
              slotDistribution[nodeId] = 0;
            }
            slotDistribution[nodeId] += slotCount;
          });
      
        } catch (err) {
          console.error('Error fetching slot distribution:', err);
        } finally {
          redis.disconnect();
          next(null, slotDistribution);
        }
      }

      getSlotDistribution();
      
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
    logCommand(`### CREATING CLUSTER OF 3 NODES ${clusterNodes} ###\n`);
    const command = `redis-cli --cluster create ${clusterNodes} --cluster-replicas 0 --cluster-yes | grep OK | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    console.log(`> ${command}`);

    checker(command, (err, result, next) => {
        if (err) return next(err);
        if (result.includes('All nodes agree')) return next(null, 'cluster created successfully');
        next(null, result);
    }, false, nodes.length - 1 , 2000, next);
}

module.exports.flushall = (nodes, next) => {
    async.eachOf(nodes, (node, nodeName, next) => {
        logCommand(`### FLUSHING DATABASE : ${node.host}:${node.port} ###`);
        const command = `redis-cli -h ${node.host} -p ${node.port} flushall`;
        console.log(`> ${command}`);
        checker(command, (err, result, next) => {
            if (err) return next(err);
            next(null, result)
        }, true, 0, 0, next);
    }, (err) => {
        if (err) return next(err);
        next(null, 'cluster flushed successfully!');
    });
}

module.exports.addMaster = (clusterNode, nodeToAdd, next) => {
    logCommand(`### ADDING ${nodeToAdd.host}:${nodeToAdd.port} NODE TO CLUSTER ###\n`);
    const command = `redis-cli --cluster add-node ${nodeToAdd.host}:${nodeToAdd.port} ${clusterNode.host}:${clusterNode.port} | awk '{ gsub(/\x1b\[[0-9;]*m/, ""); print }'`;
    console.log(`> ${command}`);

    checker(command, (err, result, next) => {
        if (err) return next(err);
        const lines = result.split('\n');
        for (let line of lines) {
            if (line.includes("added")) return next(null, `node added successfully`);
            // if (line.includes("added")) return next(null, line);
        }
        next(`ERROR >>> ${result}`);
        // next(null, result)
    }, false, 1, 2000, next);
}

module.exports.rebalance = (node, next) => {
    logCommand(`### REBALANCING CLUSTER ON ${node.host}:${node.port} ###\n`);
    const command = `redis-cli --cluster rebalance ${node.host}:${node.port} --cluster-use-empty-masters | grep -i Rebalancing`;
    console.log(`> ${command}`)
    checker(command, (err, result, next) => {
        if (err) return next(err);
        next(null, `${result}\n`)
    }, false, 0, 0, next);

    
}

module.exports.removeMaster = (node, next) => {
    logCommand(`### REMOVING ${node.host}:${node.port} FROM CLUSTER ###\n`);
    const nodeIdCommand = `redis-cli -h ${node.host} -p ${node.port} CLUSTER MYID`;
    async.waterfall([
        next => shell.run(nodeIdCommand, (err, result) =>err ? next(err) : next(null, result.trim())),
        (nodeId, next) => {
            // const resultCommand = `redis-cli -h ${node} -p ${port} cluster forget ${nodeId}`;
            const resultCommand = `redis-cli --cluster del-node ${node.host}:${node.port} ${nodeId}`;
            console.log(`> ${resultCommand}`);
            checker(resultCommand, (err, result, next) => err ? next(err) : next(null, result.trim()), false, 0, 0, next); // nodeCount is 0 becuase it is already decreased in the reshard.

            // shell.run(resultCommand, (err, result) => err ? next(err) : next(null, result.trim()));
        }
    ],  (err, result) => {
        if(err) return next(err);
        // next(null, `removed successfully!`);
        next(null, result.split('>>> ').join('').trim('\n'));
    });
}

module.exports.reshard = (nodeTo, nodeFrom, slots, last, next) => {
    logCommand(`### RESHARDING FROM ${nodeFrom.host} TO ${nodeTo.host} ###\n`);
    console.log({reshardFrom: nodeFrom.host, reshardTo: nodeTo.host, slots});
    const clusterToIdCommand = `redis-cli -h ${nodeTo.host} -p ${nodeTo.port} CLUSTER NODES | grep myself | cut -d" " -f1`;
    const clusterFromIdCommand = `redis-cli -h ${nodeFrom.host} -p ${nodeFrom.port} CLUSTER NODES | grep myself | cut -d" " -f1`;

    async.waterfall([
        next => shell.run(clusterToIdCommand, (err, result) => err ? next(err) : next(null, result.trim())),
        (clusterToId, next) => shell.run(clusterFromIdCommand, float(clusterToId, next)),
        (clusterToId, clusterFromId, next) => {
            const finalCommand = `redis-cli --cluster reshard ${nodeFrom.host}:${nodeFrom.port} --cluster-from ${clusterFromId.trim()} --cluster-to ${clusterToId.trim()} --cluster-slots ${slots} --cluster-yes | grep Ready`;
            checker(finalCommand, (err, result, next) => err ? next(err) : next(null, 'resharded successfully!'), false, last ? -1 : 0, 0, next);
            
            // shell.run(finalCommand, (err, result) => err ? next(err) : next(null, 'resharded successfully!'));
        }
    ], next);
}

module.exports.writeKeys = (clusterNodes, keyCount, startTime, next) => {
    logCommand(`### WRITING ${keyCount} KEYS ###\n`);
    const cluster = new Redis.Cluster(clusterNodes);
    const atOnce = keyCount < 10000 ? keyCount : 10000
    let check1 = '';
    async.series([
        next => module.exports.check(nodes[0], (err, result) => {
            if (err) return next(err);
            check1 = result;
            next(null);
        }),
        next => async.timesSeries(keyCount/atOnce, (i, next) => async.times(atOnce, (j, next) => {
            let key   = `${startTime}${j+i*atOnce}`;
            let value = `${startTime}${j+i*atOnce}`;
            cluster.set(key, value, (err, result) => {
                if (err) {
                console.error(`Error setting ${key}:`, err);
                return next(err);
                }
                next(null);
            });
        }, err => {
            // console.log(`${atOnce} keys written`);
            next(null);
        }), (err) => {
            cluster.quit();
            if (err) return next(err);
            next(err, `${keyCount/1000000}M keys written successfully`);
        }),
        next => module.exports.check(nodes[0], (err, check2) => {
            if (err) return next(err);
            assert(false, keyCount, 0, check1, check2);
            next(null);
        }),
        next => {
            
            
            next(null)
        }
    ], (err, results) => next(err, err ? undefined : results[1]));
}

