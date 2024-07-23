const file = require('fs');
const {run} = require('./modules/shell');
const async = require('async');

const ansibleLogs = `./logs/ansible`;
const inventory = `./infra/terraform/multiple/${process.argv[2]}/inventory.json`;
const inventoryRaw = `./infra/terraform/multiple/${process.argv[2]}/inventory_raw.json`;

const processInventory = {
    aws: next => {
        const nodes = require(inventoryRaw);
        let content = [];
        for (let i = 0; i < nodes.length; i++) {
            content.push({
                host: nodes[i].private_ip,
                public_ip: nodes[i].public_ip,
                port: 6379
            });
        }        
        file.writeFile(inventory, JSON.stringify(content, null, 2), next);
    },
    gcp: next => {
        const nodes = require(inventoryRaw);
        let content = [];
        for (let i = 0; i < nodes.length; i++) {
            content.push({
                public_ip: nodes[i].network_interface[0].access_config[0].nat_ip,
                host: nodes[i].network_interface[0].network_ip,
                port: 6379
            });
        }
        file.writeFile(inventory, JSON.stringify(content, null, 2), next);
    }
}

const runAnsible = (nodes, next) => {
    async.eachOf(nodes, (item, key, next) => {
        async.series([
            next => {
                if (!file.existsSync(ansibleLogs)){
                    file.mkdirSync(ansibleLogs);
                }
                next(null);
            },
            next => run(`echo "run" > "${ansibleLogs}/${item.public_ip}"`, next),
            next => run(`ssh-keygen -F "${item.public_ip}" && ssh-keygen -f "$HOME/.ssh/known_hosts" -R "${item.public_ip}"`, next),
            next => run(`tmux new-session -d "ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook -i '${item.public_ip},' -u ubuntu --private-key ./redis${process.argv[2]}.pem ./infra/ansible/multiple/redis.yml --extra-vars "cloud=${process.argv[2]}">> '${ansibleLogs}/${item.public_ip}'"`, (err, result)=>{
                if (err) next(err);
                console.log(result);
                next(null);
            })
        ], next);
    }, next);
}

let nodes;
async.series([
    next => processInventory[process.argv[2]](next),
    next => {
        nodes = require(inventory);
        next(null);
    },
    next => run(`rm -rf $HOME/.ssh/known_hosts/known_hosts.* `, next),
    // next => setTimeout(() => {next(null)}, 15000),
    next => runAnsible(nodes, next),
], (err, result) => console.log('---done---', {err, result}));

