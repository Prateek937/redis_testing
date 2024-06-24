#!/bin/bash

inventory=$(cat ./inventory.json) #reading inventory.json
latest=$(cat ./latest.json | jq ."latest")

nodes=($(echo "$inventory" | jq -c '.[]')) #convert the object to array

# function to count the keys and nodes
check() {
    redis-cli --cluster check $(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)') | grep keys
} 

# checking after every step
check 

# create cluster of three nodes
clusterNodes=($(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)')  $(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)') $(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)'))
redis-cli --cluster create  ${clusterNodes[@]} --cluster-replicas 0 --cluster-yes | grep OK

# flush cluster
redis-cli -h $(echo "${nodes[0]}" | jq -r '.private_ip') -p 6379 flushall
redis-cli -h $(echo "${nodes[1]}" | jq -r '.private_ip') -p 6379 flushall
redis-cli -h $(echo "${nodes[2]}" | jq -r '.private_ip') -p 6379 flushall

# add 4th node to the cluster
nodeToAdd=$(echo "${nodes[3]}" | jq -r '.private_ip + ":" + (.port|tostring)')
existingNode=$(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)')
redis-cli --cluster add-node $nodeToAdd $existingNode 
check

# rebalance cluster
redis-cli --cluster rebalance $nodeToAdd --cluster-use-empty-masters
check

# reshard 4th node to first node
nodeFromId=$(redis-cli -h $(echo "${nodes[3]}" | jq -r '.private_ip') -p 6379 CLUSTER MYID)
nodeToId=$(redis-cli -h $(echo "${nodes[0]}" | jq -r '.private_ip') -p 6379 CLUSTER MYID)
nodeFrom=$(echo "${nodes[3]}" | jq -r '.private_ip + ":" + (.port|tostring)')
redis-cli --cluster reshard  $nodeFrom --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 4096 --cluster-yes | grep Ready
check

# delete 4th node from the cluster
redis-cli -h $(echo "${nodes[3]}" | jq -r '.private_ip') -p 6379 CLUSTER MYID
redis-cli --cluster del-node $(echo "${nodes[3]}" | jq -r '.private_ip') $nodeFromId
check

#rebalance again
redis-cli --cluster rebalance $(echo "${nodes[0]}" | jq -r '.private_ip + ":" + (.port|tostring)') --cluster-use-empty-masters
check
