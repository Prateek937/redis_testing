const file = require('fs');
const {run} = require('../../../modules/run');
const async = require('async');


const processInventory = (inventory, next) => {
    const nodes = require(inventory);
    let content = {};
    for (let i = 0; i < nodes.length; i++) {
        content[`node${i+1}`] = {
            private_ip: nodes[i].private_ip,
            public_ip: nodes[i].public_ip,
            port: 6379
        }
    }
    file.writeFile('./inventory.json', JSON.stringify(content, null, 2), next);
}

const runAnsible = (nodes, next) => {
    // let adhocInventory = '';
    // for (const key in nodes) {
    //     let node = nodes[key];
    //     adhocInventory += `${node.public_ip},`;
    // }
    async.eachOf(nodes, (item, key, next) => {
        run(`ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook -i '${item.public_ip},' -u ubuntu --private-key ../../redis.pem ../../ansible/multiple/redis.yml`, (err, result)=>{
            if (err) next(err);
            console.log(result);
            next(null);
        });
    }, next);
}

let nodes;
async.series([
    next => processInventory('./inventory_raw.json', next),
    next => {
        nodes = require('./inventory.json');
        next(null);
    },
    next => runAnsible(nodes, next),
], (err, result) => console.log('---done---', {err, result}));

