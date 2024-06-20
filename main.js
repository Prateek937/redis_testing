const file = require('fs');
const async = require('async');
const prompt = require('prompt-sync')();
const addNode = require('./modules/addNode');
const countSlotKeys = require('./modules/countSlotKeys');
const cluster = require('./modules/createCluster');
const rebalance = require('./modules/rebalance');
const removeMaster = require('./modules/removeMaster');
const reshard = require('./modules/reshard');
const writeKeys = require('./modules/writeKeys');
const flushdb = require('./modules/flushdb');
const inputs = require('./inputs');


const min = inputs.min;
const max = inputs.max;
const nodes = require('./inventory.json');
let latest;
try {
    latest = require('./latest.json').latest;
} catch (err) {
    latest = 0;
}

function printTime(timeTaken) {
    console.log(`Time Taken: ${timeTaken / 1000} seconds...\n`);
}

function wait(seconds, next) {
    console.log(`WAITING FOR ${seconds} seconds...\n`);
    setTimeout(() => {
        next(null);
    }, seconds * 1000);
}

function count(next) {
    console.log(`### COUNT NODES ###\n`);
    countSlotKeys.countSlotKey(nodes.node1.private_ip, nodes.node1.port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        next(null);
    });
}

function reverse(object) {
    const reversed = {};
    Object.keys(object).reverse().map(key => reversed[key] = object[key]);
    return reversed;
}

function createClusterofThreeNodes(next) {
    console.log(`### CREATING CLUSTER OF 3 NODES ###\n`);
    const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, 3));
    console.log({ clusterNodes });
    async.series([
        next => cluster.createCluster(clusterNodes, (err, result) => {
            if (err) return next(err);
            console.log(`${result}\n`);
            console.log("### FLUSHING DATABASE ###\n");
            printTime(Date.now() - startTime);
            flushdb.flushall(clusterNodes, next);
        }),
        next => {
            latest = 3;
            file.writeFile('./latest.json', JSON.stringify({ latest: 3 }, null, 2), next)
        }
    ], next);
}

function rebalanceCluster(node, next) {
    console.log("### REBALANCING CLUSTER ###\n");
    const st1 = Date.now()
    rebalance.rebalanceCluster(node.private_ip, node.port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now() - st1);
        next(null);
    });
}

function reshardNode(nodeFrom, nodeTo, next) {
    console.log(`### RESHARDING FROM ${nodeFrom.private_ip} TO ${nodeTo.private_ip} ###\n`);
    const st1 = Date.now();
    reshard.reshard(nodeTo, nodeFrom, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now() - st1);
        next(null);
    });
}

function removeNode(host, port, next) {
    console.log(`### REMOVING ${host}:${port} FROM CLUSTER ###\n`);
    const st1 = Date.now();
    removeMaster.removeMaster(host, port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now() - st1);
        next(null);
    });
}

function addMasterNode(nodeTo, node, next) {
    console.log(`### ADDING ${node.private_ip}:${node.port} NODE TO CLUSTER ###\n`);
    const st1 = Date.now();
    addNode.addMaster(nodeTo, node, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now() - st1);
        next(null);
    });
}

function addKeys(keys, next) {
    console.log(`### WRITING ${keys} KEYS ###\n`);
    const st1 = Date.now();
    let clusterNodes = [];
    const nodeList = Object.keys(nodes);
    for (let i = 0; i < latest; i++) {
        let node = nodes[nodeList[i]];
        clusterNodes.push({ host: node.private_ip, port: node.port });
    }
    console.log(clusterNodes);
    // build unique keys from `${starttime}:${counter}`
    writeKeys.writeKeys(clusterNodes, keys, startTime, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now() - st1);
        count(next);
    });
}


function flushCluster(next) {
    console.log("### FLUSHING DATABASE ###\n");
    const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, latest));
    flushdb.flushall(clusterNodes, next);
}

function minimizeClusterToThreeNodes(next) {
    // console.log(`MINIMIZING CLUSTER TO 3 NODES------------------------\n\n`)
    async.series([
        // flush the current cluster
        next => flushCluster(next),
        next => count(next),
        // reshard -diff nodes, always take from the highest and put to the lowest
        next => {
            const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(3, latest)));
            const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, 3))
            async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]], nodesTo[Object.keys(nodesTo)[i % 3]], next), next)
        },
        next => wait(10, next),
        next => count(next),
        // delete -diff nodes, always delete the highest
        next => {
            const removeNodes = reverse(Object.fromEntries(Object.entries(nodes).slice(3, latest)));
            async.eachOf(removeNodes, (node, nodeName, next) => removeNode(node.private_ip, node.port, next), next);
        },
        next => count(next),
        next => {
            latest = 3;
            file.writeFile('./latest.json', JSON.stringify({ latest }, null, 2), next);
        }
    ], next);
}

function resizeCluster(nodeCount, next) {
    if (nodeCount < min || nodeCount > max) return next(error);
    // console.log(`RESIZING CLUSTER FROM ${latest} TO ${nodeCount} NODES------------------------\n\n`)
    const diff = nodeCount - latest;
    if (diff < 0) async.series([
        // reshard -diff nodes, always take from the highest and put to the lowest
        next => {
            const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(nodeCount, latest)));
            const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, nodeCount))
            //try parallaly as well
            async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]], nodesTo[Object.keys(nodesTo)[i % nodeCount]], next), next)
        },
        next => wait(10, next),
        next => count(next),
        // delete -diff nodes, always delete the highest
        next => {
            const removeNodes = reverse(Object.fromEntries(Object.entries(nodes).slice(nodeCount, latest)));
            async.eachOf(removeNodes, (node, nodeName, next) => removeNode(node.private_ip, node.port, next), next);
        },
        next => {
            latest = nodeCount;
            file.writeFile('./latest.json', JSON.stringify({ latest }, null, 2), next)
        },
        next => count(next),
        // rebalance
        next => rebalanceCluster(nodes[Object.keys(nodes)[nodeCount - 1]], next),
        next => wait(5, next),
        next => count(next),
        // store latest to file
        next => {
            latest = nodeCount;
            file.writeFile('./latest.json', JSON.stringify({ latest }, null, 2), next);
        }
    ], next);
    else if (diff > 0) async.series([
        // add diff nodes, always add the highest
        next => {
            const addNodes = Object.fromEntries(Object.entries(nodes).slice(latest, nodeCount));
            //doing in series because if one node fails to add, remaining are added then if we run it again it creates problems
            async.eachOfSeries(addNodes, (node, key, next) => addMasterNode(nodes.node1, node, next), next);
        },
        next => {
            latest = nodeCount;
            file.writeFile('./latest.json', JSON.stringify({ latest }, null, 2), next)
        },
        next => wait(5, next),
        next => count(next),
        // rebalance
        next => rebalanceCluster(nodes[Object.keys(nodes)[latest - 1]], next),
        next => wait(5, next),
        next => count(next),
    ], next);
    else next(null);
}

const startTime = Date.now();
async.series([
    next => {
        if (latest > 0) return next(null) ;
        count(next);
    },
    next => async.eachOfSeries(inputs.changes, (change, key, next) => {
        console.log(`\n******* ${change.type}, ${change.value} *******\n`)
        switch (change.type) {
            case 'init': {
                console.log({latest});
                if (latest < 3) return createClusterofThreeNodes(next);
                if (latest > 3) return minimizeClusterToThreeNodes(next);
                return flushCluster(next);
            }
            case 'write': return addKeys(change.value, next);
            case 'flush': return flushCluster(next);
            case 'resize': return resizeCluster(change.value, next);
            default: next(`Unknown operation ${change.type}`)
        }
    }, next)
], (...args) => {
    printTime(Date.now() - startTime);
    console.log('---DONE---', ...args);
});


// if latest  = 0 no count
//count after writing


// 7* type value 7* - per change
// 3# redisCommand, args, 3# - per redis instruction
// success {redisCommand} or the error
// Count - after every redis instruction
