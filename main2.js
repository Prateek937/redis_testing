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

const min = 3;
const max = 10;
const nodes = require('./inventory.json');
try {
    let latest = require('./latest.json').latest;
} catch (err) {
    let latest = 0;
}

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

function reverse(object) {
    const reversed = {};
    Object.keys(object).reverse().map(key => reversed[key] = object[key]);
    return reversed;
}

function createClusterofThreeNodes(clusterNodes, next) {
    console.log(`> CREATING CLUSTER OF ${Object.keys(clusterNodes).length} NODES...\n\n`);
    console.log({clusterNodes});
    cluster.createCluster(clusterNodes, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        console.log("> FLUSHING DATABASE...\n\n");
        printTime(Date.now()-t1);
        flushdb.flushall(clusterNodes, next);
    });
}

function rebalanceCluster(node, next) {
    console.log("> REBALANCING CLUSTER...\n\n");
    const st1 = Date.now()
    rebalance.rebalanceCluster(node.private_ip, node.port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now()-st1);
        next(null);
    });
}

function reshardNode(nodeFrom, nodeTo, next) {
    console.log(`> RESHARDING ${reshardNode.private_ip}...\n\n`);
    const st1 = Date.now();
    reshard.reshard(nodeTo, nodeFrom, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`); 
        printTime(Date.now()-st1);
        next(null);
    });
}

function removeNode(host, port, next) {
    console.log(`> REMOVING ${host}:${port} FROM CLUSTER...\n\n`);
    const st1 = Date.now();
    removeMaster.removeMaster(host, port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now()-st1);
        next(null);
    });
}

function addMasterNode(nodeTo, node, next) {
    console.log(`> ADDING ${node.private_ip}:${node.port} NODE TO CLUSTER...\n\n`);
    const st1 = Date.now();
    addNode.addMaster(nodeTo, node, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now()-st1);
        next(null);
    });
}

function addKeys(keys, next)  { 
    console.log(`> WRITING ${keys} KEYS...\n\n`);
    const st1 = Date.now();
    let clusterNodes = [];
    const nodeList = Object.keys(nodes);
    for (let i = 0; i < latest; i++) {
        let node = nodes[nodeList[i]];
        clusterNodes.push({host: node.private_ip, port: node.port});
    }
    console.log(clusterNodes);
    // build unique keys from `${starttime}:${counter}`
    writeKeys.writeKeys(clusterNodes, keys, startTime, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        printTime(Date.now()-st1);
        next(null);
    });
}


function flushCluster(next) {
    console.log("> FLUSHING DATABASE...\n\n");
    const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, latest));
    flushdb.flushall(clusterNodes, next);
}

function createCluster(count, next) {
    async.series([
        next => {
            const clusterNodes = Object.fromEntries(Object.entries(nodes).slice(0, count));
            createCluster(clusterNodes, next);
        },
        next => {
            latest = count;
            file.writeFile('./latest.json', JSON.stringify({latest}, null, 2), next);
        }
    ], next);
    
}

function minimizeClusterToThreeNodes(next) { 
    async.series([
        // flush the current cluster
        next => flushCluster(next),
        // reshard -diff nodes, always take from the highest and put to the lowest
        next => {
            const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(3, latest)));
            const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, 3))
            async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]] ,nodesTo[Object.keys(nodesTo)[i % 3]], next), next)
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
            file.writeFile('./latest.json', JSON.stringify({latest}, null, 2), next);
        }
    ], next);
}

function resizeCluster(count, next) {
    if (count < min || count > max) return next(error);
    const diff = count - latest;
    if (diff < 0) async.series([
        // reshard -diff nodes, always take from the highest and put to the lowest
        next => {
            const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(count, latest)));
            const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, count))
            async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]] ,nodesTo[Object.keys(nodesTo)[i]], next), next)
        },
        next => wait(10, next),
        next => count(next),
        // delete -diff nodes, always delete the highest
        next => {
            const removeNodes = reverse(Object.fromEntries(Object.entries(nodes).slice(count, latest)));
            async.eachOf(removeNodes, (node, nodeName, next) => removeNode(node.private_ip, node.port, next), next);
        },
        next => count(next),
        // rebalance
        next => rebalanceCluster(nodes[Object.keys(nodes)[count - 1]], next), 
        next => wait(5, next),
        next => count(next),
        // store latest to file
        next => {
            latest = count;
            file.writeFile('./latest.json', JSON.stringify({latest}, null, 2), next);
        }
    ], next);
    else if (diff > 0) async.series([
        // add diff nodes, always add the highest
        next => { 
            const addNodes = Object.fromEntries(Object.entries(nodes).slice(latest, count));
            async.eachOf(addNodes, (node, key, next) => addMasterNode(nodes.node1, node, next), next);
        },
        next => wait(5, next),
        next => count(next),
        // rebalance
        next => rebalanceCluster(nodes[Object.keys(nodes)[count - 1]], next), 
        next => wait(5, next),
        next => count(next),
        // store latest to file
        next => {
            latest = count;
            file.writeFile('./latest.json', JSON.stringify({latest}, null, 2), next);
        }
    ], next);
    else next(null);
}

const changes = [{type: "init", },{type: "resize", value: 4}, {type: "write", value: 100000}, {type: "flush", value: null}]
const startTime = Date.now();
async.eachOfSeries(changes, (change, key, next) => {
    switch (change.type) {
        case 'init': {
            if (latest < 3) createClusterofThreeNodes(3, next);
            minimizeClusterToThreeNodes(next);
        }
        case 'write': addKeys(change.value, next);
        case 'flush': flushCluster(next);
        case 'resize': resizeCluster(change.value, next);
        default: next(`Unknown operation ${change.type}`);
    }
}, console.log);
printTime(Date.now() - startTime);

