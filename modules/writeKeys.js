const async = require('async');
const {run} = require('./run');

module.exports.writeKeysToSingleMaster = (nodes, keyCount, next) => {
    let count = 0;
    async.timesSeries(keyCount, (i, next) => {
        const setCommand = `redis-cli -h ${nodes.node1.ip} -p ${nodes.node1.port} SET key${i} value${i}`;
        run(setCommand, (err, result) => {
            if (err) return next(err);
            if (result.includes('MOVED')) {
                count++;
                let [newHost, newPort] = result.split(' ')[2].split(':')
                let command = `redis-cli -h ${newHost.trim()} -p ${newPort.trim()} SET key${i} value${i}`;
                run(command, (err, result2) => {
                    if (err) return next(err);
                    if (!(result2.includes('OK'))) return next(result2)
                    return next(null, result2);
                })
            } else {
                next(null, result);
            }
        })
    }, (err, result) => next(err, `${keyCount} keys written successfully! with ${count} exceptions`)); 
}


