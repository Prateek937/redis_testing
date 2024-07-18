const file = require('fs');
const async = require('async');
const prompt = require('prompt-sync')();
const cluster = require('./modules/cluster');
const inputs = require('./inputs');
const min = inputs.min;
const max = inputs.max;
const nodes = require('./inventory.json');
const { CLIENT_RENEG_LIMIT } = require('tls');
const { removeAllListeners } = require('process');

let clusterSize;

// ANSI escape codes for text color
const red = '\x1b[31m';
const green = '\x1b[32m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';


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
    }, (err) => {
        if (err) return next(err);
        console.log('\n');
        next(null);
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

function addNodes(clusterNode, nodesToAdd, next) {
    async.series([
        next => async.eachOfSeries(nodesToAdd, (node, index, next) => {
            async.series([
                next => cluster.addMaster(clusterNode, node, log(next)),
                next => wait(2, log(next)),
                next => {clusterSize += 1; next(null);}
            ], next);
        }, next),
        next => wait(10, log(next)),
        next => cluster.check(clusterNode, log(next)),
        next => cluster.rebalance(nodesToAdd[0], log(next)),
        next => cluster.check(clusterNode, log(next)),
    ], next);
}

function removeNodes(clusterNodes, removeCount, next) {
    const remainingNodes = clusterSize - removeCount;
    if (clusterSize < removeCount) return next(new Error('removing more than the cluster size is not possible'));
    let slots;
    async.series([
        next => cluster.rebalance(clusterNodes[clusterSize - 1], log(next)),
        next => cluster.check(clusterNodes[0], log(next)),
        next => cluster.getSlots(clusterNodes[clusterSize - 1], (err, result) => {
            if (err) return next(err);
            slots = result; next(null);
        }),
        next => async.timesSeries(removeCount, (i, next) => {
            async.series([
                next => {
                    let slotsToMove = slots[`${clusterNodes[clusterSize - 1].host}:${clusterNodes[clusterSize - 1].port}`];
                    let ceil = Math.ceil(slotsToMove/remainingNodes);
                    let floor = Math.floor(slotsToMove/remainingNodes);
                    let extraSlots = slotsToMove%remainingNodes;
                    let distribution = Array(extraSlots).fill(ceil).concat(Array(remainingNodes - extraSlots).fill(floor));
                    console.log({distribution}); 
                    async.timesSeries(remainingNodes, (n, next) => {
                        async.series([
                            // the below double modulous is to balance the number of slots in nodes with a difference no more than 1.
                            next => cluster.reshard(clusterNodes[(i + n) % remainingNodes], clusterNodes[clusterSize - 1], distribution[n], log(next)),
                            next => wait(2, log(next)),
                            // next => cluster.check(clusterNodes[0], log(next)),
                        ], next);
                    }, next);
                },
                next => cluster.check(clusterNodes[0], log(next)),
                next => cluster.removeMaster(clusterNodes[clusterSize - 1], log(next)),
                next => cluster.check(clusterNodes[0], log(next)),
                next => {clusterSize--; next(null);},
            ], next)
        }, next),
        next => cluster.rebalance(clusterNodes[0], log(next)),
        next => cluster.check(clusterNodes[0], log(next)),
        next => wait(65, log(next)) // wait for 60 seconds for the nodes to be re-added
    ], next);
}


function resizeCluster(clusterNodes, resizeTo, next) {
    console.log({clusterSize});
    if (resizeTo < min || resizeTo > max) return next(new Error(`resize count not in range [${min}, ${max}]`));
    const diff = resizeTo - clusterSize;
    if (diff < 0) removeNodes(clusterNodes, -diff, next);
    else if (diff > 0) addNodes(clusterNodes[0], nodes.slice(clusterNodes.length, resizeTo), next);
    else next(null);
}

function createCluster(clusterNodes, next) {
    async.series([
        next => cluster.createCluster(clusterNodes, (err, result) => {
            if (err) return next(err);
            clusterSize = clusterNodes.length;
            console.log(result);
            next(null, result);
        }),
        next => cluster.check(clusterNodes[0], log(next))
    ], next);
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
        console.log(`\n${blue}******* ${change.type} ${change.value === undefined ? '' : ', ' + change.value} *******${reset}\n` );
        switch (change.type) {
            case 'init': {
                if (clusterSize < 3) return createCluster(nodes.slice(0, 3), next); // create cluster of three nodes
                if (clusterSize > 3) return async.series([
                    next => cluster.flushall(nodes.slice(0, clusterSize), log(next)),
                    next => resizeCluster(nodes.slice(0, clusterSize), 3, next) //resize to thee nodes
                ], next);
                return cluster.flushall(nodes.slice(0, 3), log(next)); 
            }
            case 'write': return async.series([
                next => cluster.writeKeys(nodes.slice(0, clusterSize), change.value, Date.now(), log(next)),
                next => cluster.check(nodes[0], log(next))
            ], next);
            case 'flush': return cluster.flushall(nodes.slice(0, clusterSize), log(next));
            case 'resize': return resizeCluster(nodes.slice(0, clusterSize), change.value, next);
            default: next(`Unknown operation ${change.type}`)
        }
    }, next)
], (...args) => {
    printTime(Date.now() - startTime);
    console.log('---DONE---', ...args);
});
