const async = require('async');
const {run} = require('./run');

module.exports.writeKeysToSingleMaster = (nodes, keyCount, next) => {
    const count = 0;
    async.timesSeries(keyCount, (i, next) => {
        const setCommand = `redis-cli -h ${nodes.node1.ip} -p ${nodes.node1.port} SET key${i} value${i}`;
        run(setCommand, (err, result) => {
            if (err) return next(err);
            count++;
            next(null, result)
        })
    }, (err, result) => next(err, `${keyCount} keys written successfully!`)); 

}
