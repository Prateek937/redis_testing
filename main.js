const file = require('fs');
const async = require('async');
const prompt = require('prompt-sync')();
const cluster = require('./modules/cluster');
const inputs = require('./inputs');

const min = inputs.min;
const max = inputs.max;
const nodes = require('./inventory.json');
let clusterSize;

function reverse(object) {
    const reversed = {};
    Object.keys(object).reverse().map(key => reversed[key] = object[key]);
    return reversed;
}

function printTime(timeTaken) {
    console.log(`Time Taken: ${timeTaken / 1000} seconds...\n`);
}

function wait(seconds, next) {
    process.stdout.write(`waiting... `);
    async.timesSeries(seconds, (i, next) => {
        setTimeout(() => {
            process.stdout.write(`${seconds - i} `);
            next(null);
        }, 1000);
    }, (err, results) => {
        if (err) return next(err);
        console.log('\n');
        next(null, results);
    });
}

function log(next) {
    const st1 = Date.now();
    return (err, ...args) => {
        if (err) return next(err);
        console.log(...args);
        printTime(Date.now() - st1);
        next(null, ...args);
    }
}

function addNodes(addTo, nodesToAdd, next) {
    async.series([
        next => async.eachOfSeries(nodesToAdd, (node, index, next) => cluster.addMaster(addTo, node, log(next)), next),
        next => wait(2, log(next)),
        next => cluster.check(addTo, log(next)),
        next => cluster.rebalance(nodesToAdd[0], log(next)),
        next => cluster.check(addTo, log(next)),
        next => {clusterSize += 1; next(null);}
    ], next);
}

function removeNodes(clusterNodes, removeCount, next) {
    const clusterSize = clusterNodes.length;
    const remaining = clusterSize - removeCount;
    if (clusterSize < removeCount) return next(new Error("removing more than cluster size is not possible."));
    async.series([
        next => cluster.rebalance(clusterNodes[clusterSize - i - 1], next),
        next => async.timesSeries(removeCount, (i, next) => async.waterfall([
            next => cluster.countSlots(clusterNodes[clusterSize - i - 1], next),
            (slots, next) => async.timesSeries(remaining, (n, next) => {
                let slotsToReshard = (i+1 == remaining) ?  (slots/(remaining)) + (slots % (remaining)) : (slots/(remaining));
                console.log({reshardTo: clusterNodes[n], reshardFrom: clusterNodes[clusterSize - i - 1], slotsToReshard});
                async.series([
                    next => cluster.reshard(clusterNodes[n], clusterNodes[clusterSize - i - 1], slotsToReshard, log(next)),
                    next => wait(2, log(next)),
                    next => cluster.check(clusterNodes[0], log(next)),
                ], next);
            }, next),
            next => async.series([
                next => cluster.removeMaster(clusterNodes[clusterSize - i - 1], log(next)),
                next => cluster.check(clusterNodes[0], log(next)),
                next => {clusterSize -= 1; next(null);}
            ], next)
        ], next), next) 
    ], next);
}

function resizeCluster(clusterNodes, resizeTo, next) {
    if (nodeCount < min || nodeCount > max) return next(new Error(`resize count not in range [${min}, ${max}]`));
    const diff = resizeTo - clusterNodes.length;
    if (diff < 0) removeNodes(clusterNodes, -1 * diff, next);
    else if (diff > 0) addNodes(clusterNodes[0], nodes.slice(clusterNodes.length, resizeTo), next);
    else next(null);
}

function createCluster(clusterNodes, next) {
    cluster.createCluster(clusterNodes, log((err, result) => {
        if (err) return next(err);
        clusterSize = clusterNodes.length;
        next(null, result)
    }));
}

function log(next) {
    const st1 = Date.now();
    return (err, ...args) => {
        if (err) return next(err);
        console.log(...args);
        printTime(Date.now() - st1);
        next(null, ...args);
    }
}

const startTime = Date.now();
async.waterfall([
    next => cluster.countNodes(nodes[0], next),
    (result, next) => {
        clusterSize = result;
        console.log(`cluster Size: ${clusterSize}`);
        if (clusterSize > 1) return cluster.check(nodes[0], log(next));
        next(null);
    },
    next => async.eachOfSeries(inputs.changes, (change, key, next) => {
        console.log('------------------------------------------------------------------');
        console.log(`\n******* ${change.type}, ${change.value} *******\n`);
        switch (change.type) {
            case 'init': {
                if (clusterSize < 3) return createCluster(nodes.slice(0, 3), next); // create cluster of three nodes
                if (clusterSize > 3) return resizeCluster(nodes.slice(0, clusterSize), 3, next); //resize to thee nodes
                return cluster.flushall(nodes.slice(0, 3), log(next)); 
            }
            case 'write': return cluster.writeKeys(nodes.slice(0, clusterSize), change.value, startTime, log(next));
            case 'flush': return cluster.flushall(nodes.slice(0, clusterSize), log(next));
            case 'resize': return resizeCluster(nodes.slice(0, clusterSize), change.value, next);
            default: next(`Unknown operation ${change.type}`)
        }
    }, next)
], (...args) => {
    printTime(Date.now() - startTime);
    console.log('---DONE---', ...args);
});

// 7* type value 7* - per change
// 3# redisCommand, args, 3# - per redis instruction
// success {redisCommand} or the error
// Count - after every redis instruction


// no need to store the latest. ask the clutster

// log of output