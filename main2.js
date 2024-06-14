const addNode = require('./modules/addNode');
const file = require('fs');

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

const scratch = false;
const starttime = Date.now();
const keys = 100000;
const min = 3;
const max = 10;
const nodeCount= [4, 5, 6, 7 ,3 , 8]; // any sequence of numbers
const nodes = require('./inventory.json');
const { default: cluster } = require('cluster');
const latest = 0; // read latest from file, 0 if no file


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

const startTime = Date.now();
async.series([
	next => {
        let latest = require('./latest.json').latest;
		if (scratch === true && latest > 0) return async.series([
            next => { // flush the current cluster
                console.log("> FLUSHING DATABASE...\n\n");
                flushdb.flushall(nodes, next);
            },
            // minimize the cluster
            next => { 
                async.series([
                    // reshard -diff nodes, always take from the highest and put to the lowest
                    next => {
                        const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(3, latest)));
                        const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, item))
                        async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]] ,nodesTo[Object.keys(nodesTo)[i]], next), next)
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
                        file.writeFile('./latest.json', JSON.stringify({latest: 3}, null, 2), next);
                    }
                ], next);
            },
		], next); 
		next(null);
	},
    // add keys keys to cluster,
	next => { 
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
	},
    next => wait(5, next),
    next => count(next),
	next => {
		async.eachOfSeries(nodeCount, (item, index, next) => {
			if (item < min || item > max) return next(error);
			const diff = item - latest;
			if (diff < 0) async.series([
                // reshard -diff nodes, always take from the highest and put to the lowest
                next => {
                    const nodesFrom = reverse(Object.fromEntries(Object.entries(nodes).slice(item, latest)));
                    const nodesTo = Object.fromEntries(Object.entries(nodes).slice(0, item))
                    async.timesSeries(Object.keys(nodesFrom).length, (i, next) => reshardNode(nodesFrom[Object.keys(nodesFrom)[i]] ,nodesTo[Object.keys(nodesTo)[i]], next), next)
                },
                next => wait(10, next),
                next => count(next),
                // delete -diff nodes, always delete the highest
                next => {
                    const removeNodes = reverse(Object.fromEntries(Object.entries(nodes).slice(item, latest)));
                    async.eachOf(removeNodes, (node, nodeName, next) => removeNode(node.private_ip, node.port, next), next);
                },
                next => count(next),
                // rebalance
				next => rebalanceCluster(nodes[Object.keys(nodes)[item - 1]], next), 
				next => wait(5, next),
                next => count(next),
                // store latest to file
				next => file.writeFile('./latest.json', JSON.stringify({latest: item}, null, 2), next)
			], next);
			else if (diff > 0) async.series([
                // add diff nodes, always add the highest
                next => { 
                    const addNodes = Object.fromEntries(Object.entries(nodes).slice(latest, item));
                    async.eachOf(addNodes, (node, key, next) => addMasterNode(nodes.node1, node, next), next);
                },
				next => wait(5, next),
                next => count(next),
				// rebalance
				next => rebalanceCluster(nodes[Object.keys(nodes)[item - 1]], next), 
				next => wait(5, next),
                next => count(next),
				// store latest to file
				next => file.writeFile('./latest.json', JSON.stringify({latest: item}, null, 2), next)
			], next);
			else next(null);
		}, next);
	},
    next => {
        printTime(Date.now() - startTime);
        next(null);
    }
], console.log);
