
module.exports.processInventory = (inventory, next) => {
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
