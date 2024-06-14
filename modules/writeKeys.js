const async = require('async');
const {run} = require('./run');
const Redis = require('ioredis')

module.exports.writeKeysFromShell = (nodes, keyCount, next) => {
    let count = 0;
    //rewrite async.times and timeSeries in a different way
    async.times(keyCount, (i, next) => {
        const setCommand = `redis-cli -h ${nodes.node1.ip} -p ${nodes.node1.port} SET key${i} value${i}`;
        run(setCommand, (err, result) => {
            if (err) return next(err);
            if (result.includes('MOVED')) {
                count++;
                let [newHost, newPort] = result.split(' ')[2].split(':')
                let command = `redis-cli -h ${newHost.trim()} -p ${newPort.trim()} SET key${i} value${i}`;
                return run(command, (err, result2) => {
                    if (err) return next(err);
                    if (!(result2.includes('OK'))) return next(result2)
                    next(null);
                })
            } 
            next(null);
        })
    }, (err, result) => next(err, `${keyCount} keys written successfully! with ${count} exceptions`)); 
}

module.exports.writeKeys = (clusterNodes, keyCount, startTime, next) => {
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

