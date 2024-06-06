const addNode = require('./modules/addNode');
const countSlotKeys = require('./modules/countSlotKeys');
const createCluster = require('./modules/createCluster');
const rebalance = require('./modules/rebalance');
const removeMaster = require('./modules/removeMaster');
const reshard = require('./modules/reshard');
const writeKeys = require('./modules/writeKeys');
const processInventory = require('./modules/processInventory');
const async = require('async');

const KEYCOUNT = 1000;

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

function main(nodes, next) {
    const t1 = Date.now();
    async.series([
        // create the cluster
        next => {
            console.log("1 > CREATING CLUSTER OF THREE EMPTY NODES...\n\n");
            createCluster.createCluster(nodes, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-t1);
                next(null);
            });
        }, 
        //flush the keys
        next => wait(10, next),
        next => count(next),
        // write n keys
        next => {
            console.log(`2 > WRITING ${KEYCOUNT} KEYS...\n\n`);
            const st1 = Date.now();
            const cluster = [];
            const nodeList = Object.keys(nodes);
            for (let i = 0; i < nodeList.length - 1; i++) {
                let node = nodes[nodeList[i]];
                cluster.push({host: node.private_ip, port: node.port});
            }
            writeKeys.writeKeys(cluster, KEYCOUNT, (err, result) => {
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
            console.log("2 > REBALANCING CLUSTER...\n\n");
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
        // add 4th node
        next => {
            console.log("3 > ADDING 4TH NODE TO CLUSTER...\n\n");
            const st1 = Date.now()
            const nodeList = Object.keys(nodes);
            const clusterNode = {
                ip: nodes.node1.private_ip,
                port: nodes.node1.port
            };
            const nodeToAdd = {
                ip: nodes[nodeList[nodeList.length - 1]].private_ip,
                port: nodes[nodeList[nodeList.length - 1]].port
            };
            addNode.addMaster(clusterNode, nodeToAdd, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(5, next),
        next => count(next),
        // rebalance cluster
        next => {
            console.log("4 > REBALANCING CLUSTER...\n\n");
            const nodeList = Object.keys(nodes);
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes[nodeList[nodeList.length - 1]].private_ip, nodes[nodeList[nodeList.length - 1]].port, (err, result) => {
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
            console.log("5 > RESHARD CLUSTER...\n\n");
            const st1 = Date.now()
            const nodeList = Object.keys(nodes);
            const clusterNode = {
                ip: nodes.node1.private_ip,
                port: nodes.node1.port
            };
            const lastNode = {
                ip: nodes[nodeList[nodeList.length - 1]].private_ip,
                port: nodes[nodeList[nodeList.length - 1]].port
            };
            reshard.reshard(clusterNode, lastNode, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        // rebalance cluster
        next => {
            console.log("6 > REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            const nodeList = Object.keys(nodes);
            rebalance.rebalanceCluster(nodes[nodeList[nodeList.length - 1]].private_ip, nodes[nodeList[nodeList.length - 1]].port, (err, result) => {
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
            console.log("7 > REMOVING 4TH NODE FROM CLUSTER...\n\n");
            const st1 = Date.now()

            const nodeList = Object.keys(nodes);
            removeMaster.removeMaster(nodes[nodeList[nodeList.length - 1]].private_ip, nodes[nodeList[nodeList.length - 1]].port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => count(next),
        // print time taken
        next => {
            printTime(Date.now() - t1);
            next(null);
        }
    ], next);
}

async.waterfall([
    next => processInventory.processInventory('../infra/terraform/multiple/inventory.json',next),
    next => {
        let nodes = require('./inventory.json');
        next(null, nodes);
    },
    (nodes, next) => main(nodes, next)
], (err, result) => {
    console.log('---done---', {err, result});
})
// 
// main(nodes, (err, result) => {
//     console.log('---done---', {err, result});
// })

