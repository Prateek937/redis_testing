const file = require('fs');
const {run} = require('../../../modules/run');
const async = require('async');

const processInventory = {
    aws: (inventory, next) => {
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
    },
    gcp: (inventory, next) => {
        const nodes = require(inventory);
        let content = {};
        for (let i = 0; i < nodes.length; i++) {
            content[`node${i+1}`] = {
                public_ip: nodes[i].network_interface[0].access_config[0].nat_ip,
                private_ip: nodes[i].network_interface[0].network_ip,
                port: 6379
            }
        }
        file.writeFile('./inventory.json', JSON.stringify(content, null, 2), next);
    }
}

const runAnsible = (nodes, next) => {
    async.eachOf(nodes, (item, key, next) => {
        run(`ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook -i '${item.public_ip},' -u ubuntu --private-key ../../redis${process.argv[2]}.pem ../../ansible/multiple/redis.yml`, (err, result)=>{
            if (err) next(err);
            console.log(result);
            next(null);
        });
    }, next);
}

let nodes;
async.series([
    next => processInventory[process.argv[2]]('./inventory_raw.json', next),
    next => {
        nodes = require('./inventory.json');
        next(null);
    },
    next => runAnsible(nodes, next),
], (err, result) => console.log('---done---', {err, result}));

