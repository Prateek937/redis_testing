#!/usr/bin/bash


read -p "max: " max
read -p "cloud: " cloud
terraform -chdir=./$cloud apply -var max=$max -auto-approve
command="node configure.js $cloud"
echo $command
$command