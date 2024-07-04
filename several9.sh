#!/bin/bash

inventory=$(cat ./inventory.json) #reading inventory.json
latest=$(cat ./latest.json | jq ."latest")

nodes=($(echo "$inventory" | jq -c '.[]')) #convert the object to array

node1=$(echo "${nodes[0]}" | jq -r '.private_ip')
node2=$(echo "${nodes[1]}" | jq -r '.private_ip')
node3=$(echo "${nodes[2]}" | jq -r '.private_ip')
node4=$(echo "${nodes[3]}" | jq -r '.private_ip')
node5=$(echo "${nodes[4]}" | jq -r '.private_ip')
port1=6379
port2=6379
port3=6379
port4=6379
port5=6379

command="redis-cli --cluster check $node1:6379" 
echo -e "--------------------------------------------\n$command\n"
$command

command="redis-cli --cluster create  $node1:6379 $node2:6379 $node3:6379 --cluster-replicas 0 --cluster-yes | grep OK"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster create  $node1:6379 $node2:6379 $node3:6379 --cluster-replicas 0 --cluster-yes | grep OK

sleep 4

command="redis-cli --cluster check $node1:6379" 
echo -e "--------------------------------------------\n$command\n"
$command

command="redis-cli --cluster add-node $node4:6379 $node1:6379"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

command="redis-cli --cluster add-node $node5:6379 $node1:6379"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

command="redis-cli -h $node1 -p 6379 cluster info | grep cluster_size"
echo -e "--------------------------------------------\n$command\n"
redis-cli -h $node1 -p 6379 cluster info | grep cluster_size

command="redis-cli --cluster check $node1:6379"
echo -e "--------------------------------------------\n$command\n"
$command

command="redis-cli --cluster rebalance $node5 6379 | grep Rebalancing"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster rebalance $node5:6379 | grep Rebalancing

command="redis-cli --cluster rebalance $node5:6379 --cluster-use-empty-masters | grep Rebalancing"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster rebalance $node5:6379 --cluster-use-empty-masters | grep Rebalancing

sleep 4

command="redis-cli --cluster check $node1:6379"
echo -e "--------------------------------------------\n$command\n"
$command

nodeFromId=$(redis-cli -h $node1 -p 6379 CLUSTER MYID)
nodeToId=$(redis-cli -h $node3 -p 6379 CLUSTER MYID)
command="redis-cli --cluster reshard  $node1:6379 --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 3276  --cluster-yes | grep Ready"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster reshard  $node1:6379 --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 3276  --cluster-yes | grep Ready

sleep 4

nodeFromId=$(redis-cli -h $node2 -p 6379 CLUSTER MYID)
nodeToId=$(redis-cli -h $node4 -p 6379 CLUSTER MYID)
command="redis-cli --cluster reshard  $node2:6379 --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 3276  --cluster-yes | grep Ready"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster reshard  $node2:6379 --cluster-from $nodeFromId --cluster-to $nodeToId --cluster-slots 3276  --cluster-yes | grep Ready

commnad="redis-cli --cluster check $node1:6379"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster check $node1:6379

command="redis-cli --cluster rebalance $node5:6379 | grep Rebalancing"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster rebalance $node5:6379 | grep Rebalancing

sleep 4

command="redis-cli --cluster check $node1:6379"
echo -e "--------------------------------------------\n$command\n"
$command

nodeId=$(redis-cli -h $node1 -p 6379 CLUSTER MYID)
command="redis-cli --cluster del-node $node1:6379 $nodeId"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

nodeId=$(redis-cli -h $node2 -p 6379 CLUSTER MYID)
command="redis-cli --cluster del-node $node2:6379 $nodeId"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

command="redis-cli --cluster check $node3:6379"
echo -e "--------------------------------------------\n$command\n"
$command

#---------------------
echo "waiting 60 seconds ..."
sleep 60

command="redis-cli --cluster add-node $node1:6379 $node3:6379"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

command="redis-cli --cluster add-node $node2:6379 $node3:6379"
echo -e "--------------------------------------------\n$command\n"
$command

sleep 2

command="redis-cli -h $node3 -p 6379 cluster info | grep cluster_size"
echo -e "--------------------------------------------\n$command\n"
redis-cli -h $node3 -p 6379 cluster info | grep cluster_size

command="redis-cli --cluster check $node3:6379"
echo -e "--------------------------------------------\n$command\n"
$command

command="redis-cli --cluster rebalance $node1:6379 --cluster-use-empty-masters | grep Rebalancing"
echo -e "--------------------------------------------\n$command\n"
redis-cli --cluster rebalance $node1:6379 --cluster-use-empty-masters | grep Rebalancing

command="redis-cli -h $node3 -p 6379 cluster info | grep cluster_size"
echo -e "--------------------------------------------\n$command\n"
redis-cli -h $node3 -p 6379 cluster info | grep cluster_size

command="redis-cli --cluster check $node3:6379"
echo -e "--------------------------------------------\n$command\n"
$command