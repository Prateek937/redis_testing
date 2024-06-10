const addNode = require('./modules/addNode');
const countSlotKeys = require('./modules/countSlotKeys');
const createCluster = require('./modules/createCluster');
const rebalance = require('./modules/rebalance');
const removeMaster = require('./modules/removeMaster');
const reshard = require('./modules/reshard');
const writeKeys = require('./modules/writeKeys');
const flushdb = require('./modules/flushdb');
const {runSync} = require('./modules/run');
const async = require('async');
const prompt = require('prompt-sync')();


function printTime(timeTaken){
    console.log(`Time Taken: ${timeTaken/1000} seconds...\n`);
}

function wait(seconds, next) {
    console.log(`WAITING FOR ${seconds} seconds...\n`);
    setTimeout(() => {
        next(null);
    }, seconds*1000);
}

function count(next) {
    console.log(`COUNT NODES\n\n`);
    countSlotKeys.countSlotKey(nodes.node1.private_ip, nodes.node1.port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        next(null);
    });
}

function main(nodes, params, next) {
    const t1 = Date.now();
    async.series([
        // create the cluster
        next => {
            console.log(`> CREATING CLUSTER OF ${params.currentNodes} NODES...\n\n`);
            const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, params.currentNodes))
            console.log(22222, clusterNodes);
            createCluster.createCluster(clusterNodes, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                console.log("> FLUSHING DATABASE...\n\n");
                printTime(Date.now()-t1);
                flushdb.flushall(clusterNodes, next);
            });
        }, 
        //flush the keys
        next => wait(10, next),
        next => count(next),
        // write n keys
        next => {
            console.log(`> WRITING ${params.keyCount} KEYS...\n\n`);
            const st1 = Date.now();
            let clusterNodes = [];
            const nodeList = Object.keys(nodes);
            for (let i = 0; i < params.currentNodes; i++) {
                let node = nodes[nodeList[i]];
                clusterNodes.push({host: node.private_ip, port: node.port});
            }

            console.log(clusterNodes);
            writeKeys.writeKeys(clusterNodes, params.keyCount, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        // rebalance clusterr
        next => {
            console.log("> REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes.node2.private_ip, nodes.node2.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        // adding nodes
        next => {
            console.log(`> ADDING ${params.transitionNodes - params.currentNodes} NODE TO CLUSTER...\n\n`);
            const st1 = Date.now()
            const addNodes = Object.fromEntries(Object.entries(nodes).slice(params.currentNodes, params.transitionNodes))
            const clusterNode = {
                private_ip: nodes.node1.private_ip,
                port: nodes.node1.port
            };
            async.eachOf(addNodes, (node, key, next) => {
                console.log(node);
                addNode.addMaster(clusterNode, node, (err, result) => {
                    if (err) return next(err);
                    console.log(`${result}\n`);
                    printTime(Date.now()-st1);
                    next(null);
                });
            }, next);
        },
        next => wait(5, next),
        next => count(next),
        // rebalance cluster
        next => {
            console.log("4 > REBALANCING CLUSTER...\n\n");
            const nodeList = Object.keys(nodes);
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes.node1.private_ip, nodes.node2.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        }, 
        next => wait(10, next),
        next => count(next),
        // reshard cluster
        next => {
            console.log("> RESHARD CLUSTER...\n\n");
            const st1 = Date.now()
            const reshardNodes = Object.fromEntries(Object.entries(nodes).slice(params.finalNodes, params.transitionNodes))
            const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, params.finalNodes))

            async.times(Object.keys(reshardNodes).length, (i, next) => {
                console.log('Reshard Node:', reshardNodes[Object.keys(reshardNodes)[i]]);
                console.log('Cluster Node', clusterNodes[Object.keys(clusterNodes)[i]]);
                reshard.reshard(clusterNodes[Object.keys(clusterNodes)[i]], reshardNodes[Object.keys(reshardNodes)[i]], (err, result) => {
                    if (err) return next(err);
                    console.log(`${result}\n`); 
                    printTime(Date.now()-st1);
                    next(null);
                });
            }, next)

            
        },
        next => wait(10, next),
        next => count(next),
        // rebalance cluster
        next => {
            console.log("6 > REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            const nodeList = Object.keys(nodes);
            rebalance.rebalanceCluster(nodes.node1.private_ip, nodes.node2.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        }, 
        next => wait(5, next),
        next => count(next),
        // remove 4th node
        next => {
            console.log(`> REMOVING ${params.transitionNodes - params.finalNodes} NODE FROM CLUSTER...\n\n`);
            const st1 = Date.now()
            const removeNodes = Object.fromEntries(Object.entries(nodes).slice(params.finalNodes, params.transitionNodes))
            async.eachOf(removeNodes, (node, nodeName, next) => {
                console.log(node);
                removeMaster.removeMaster(node.private_ip, node.port, (err, result) => {
                    if (err) return next(err);
                    console.log(`${result}\n`);
                    printTime(Date.now()-st1);
                    next(null);
                });
            }, next);
            
        },
        next => count(next),
        // print time taken
        next => {
            printTime(Date.now() - t1);
            next(null);
        }
    ], next);
}

const nodes = require('./inventory.json');
const keyCount = parseInt(prompt("Key Count: "));
let maxNodes; let currentNodes;
do maxNodes = parseInt(prompt("Max Nodes: "));
while(maxNodes < 3)
do currentNodes= parseInt(prompt("Current Nodes: "));
while (currentNodes < 3 || currentNodes > maxNodes);
const transitionNodes = parseInt(prompt("Upgrade Cluster To Nodes : "));
const finalNodes = parseInt(prompt("Final Cluster To Nodes : "));

main(nodes, {keyCount: 1000, maxNodes, currentNodes, transitionNodes, finalNodes}, (err, result) => {
    console.log('---done---', {err, result});
})

