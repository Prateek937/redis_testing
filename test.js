const async = require('async');

async.eachOfSeries([{name: 1}, {name: 2}], (node, index, next) => {console.log(node), next(null, node)}, console.log);