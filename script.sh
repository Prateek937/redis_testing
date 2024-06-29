#!/bin/bash

inventory=$(cat ./inventory.json) #reading inventory.json
latest=$(cat ./latest.json | jq ."latest")

nodes=($(echo "$inventory" | jq -c '.[]')) #convert the object to array

node1=$(echo "${nodes[0]}" | jq -r '.private_ip')
node2=$(echo "${nodes[1]}" | jq -r '.private_ip')
node3=$(echo "${nodes[2]}" | jq -r '.private_ip')
node4=$(echo "${nodes[3]}" | jq -r '.private_ip')
port1=6379
port2=6379
port3=6379
port4=6379

# function to count the keys and nodes
check() {
    echo -e "\n-----------------------------------------\n"
    redis-cli --cluster check $node1:$port1 | grep keys
    echo -e "\n-----------------------------------------\n"
} 

createClusterOfThreeNodes() {
    # checking after every step
    check 

    # create cluster of three nodes
    echo -e "CREATING CLUSTER\n"
    redis-cli --cluster create  $node1:$port1 $node2:$port2 $node3:$port3 --cluster-replicas 0 --cluster-yes | grep OK
    sleep 4
    check 

}

addFourthNode() {
    # add 4th node to the cluster
    echo -e "ADDING 4TH NODE\n"
    redis-cli --cluster add-node $node4:$port4 $node1:$port1 
    sleep 4
    check

    # rebalance cluster
    echo -e "REBALACING\n"
    redis-cli --cluster rebalance $node4:$port4 --cluster-use-empty-masters | grep Rebalancing
    sleep 4
    check
}

removeFourthNode() {
    # reshard 4th node to first node
    nodeFromId=$(redis-cli -h $node4 -p $port4 CLUSTER MYID)
    nodeToId=$(redis-cli -h $node1 -p $port1 CLUSTER MYID)
    echo -e "RESHARDING FROM ${nodeFrom} \n"
    redis-cli --cluster reshard  $node4:$port4 --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 4096 --cluster-yes | grep Ready
    check

    # delete 4th node from the cluster
    echo -e "REMOVING 4TH NODE\n"
    redis-cli --cluster del-node $node4:$port4 $nodeFromId 
    check

    #rebalance again
    echo -e "REBALANCING\n"
    redis-cli --cluster rebalance $node1:$port1 --cluster-use-empty-masters | grep Rebalancing
    check
}

createClusterOfThreeNodes
addFourthNode
removeFourthNode
addFourthNode
removeFourthNode

