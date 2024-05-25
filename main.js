const { json } = require('stream/consumers');
const addNode = require('./modules/addNode');
const countSlotKeys = require('./modules/countSlotKeys');
const createCluster = require('./modules/createCluster');
const rebalance = require('./modules/rebalance');
const removeMaster = require('./modules/removeMaster');
const reshard = require('./modules/reshard');
const writeKeys = require('./modules/writeKeys');

const KEYCOUNT = 1000;

function printTime(timeTaken){
    console.log(`Time Taken: ${timeTaken} seconds...`);
}

function wait(seconds, next) {
    console.log(`WAITING FOR ${seconds} seconds...`);
    setTimeout(() => {
        next(null);
    }, seconds*1000);
}

function count(next) {
    console.log(`COUNT NODES\n\n`);
    countSlotKeys.countSlotKeys(nodes.node1.ip, nodes.node1.port, (err, result) => {
        if (err) return next(err);
        console.log(`${result}\n`);
        next(null);
    });
}

function main(nodes, next) {
    const t1 = Date.now();
    async.series([
        next => {
            console.log("1 > CREATING CLUSTER OF THREE EMPTY NODES...\n\n");
            createCluster.createCluster(nodes, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-t1);
                next(null);
            });
        }, 
        next => wait(10, next),
        next => count(next),
        next => {
            console.log(`2 > WRITING ${KEYCOUNT} KEYS...\n\n`);
            const st1 = Date.now()
            writeKeys.writeKeysToSingleMaster(nodes, KEYCOUNT, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        next => {
            console.log("2 > REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes.node2.ip, nodes.node2.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        next => {
            console.log("3 > ADDING 4TH NODE TO CLUSTER...\n\n");
            const st1 = Date.now()
            addNode.addMaster(nodes.node1.ip, nodes.node1.port, nodes.node4.ip, nodes.node4.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(5, next),
        next => count(next),
        next => {
            console.log("4 > REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes.node4.ip, nodes.node4.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        }, 
        next => wait(10, next),
        next => count(next),
        next => {
            console.log("5 > RESHARD CLUSTER...\n\n");
            const st1 = Date.now()
            reshard.reshard(nodes.node1.ip, nodes.node1.port, nodes.node4.ip, nodes.node4.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => wait(10, next),
        next => count(next),
        next => {
            console.log("6 > REBALANCING CLUSTER...\n\n");
            const st1 = Date.now()
            rebalance.rebalanceCluster(nodes.node4.ip, nodes.node4.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        }, 
        next => wait(5, next),
        next => count(next),
        next => {
            console.log("7 > REMOVIING 4TH NODE FROM CLUSTER...\n\n");
            const st1 = Date.now()
            removeMaster.removeMaster(nodes.node4.ip, nodes.node4.port, (err, result) => {
                if (err) return next(err);
                console.log(`${result}\n`);
                printTime(Date.now()-st1);
                next(null);
            });
        },
        next => count(next),
        next => {
            printTime(Date.now() - t1);
            next(null);
        }
    ], next);
}

file = open("./inventory.json")
nodes = json.load(file)
main(nodes, (err, result) => {
    console.log('---done---', {err, result});
})

