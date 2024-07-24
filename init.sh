#!/usr/bin/bash


read -p "max: " max
read -p "cloud: " cloud
if [ -z "$1" ]; then
    terraform -chdir=./infra/terraform/multiple/$cloud apply -var max=$max -auto-approve
    command="node configure.js $cloud scratch"
else
    command="node configure.js $cloud update"
fi

echo $command
$command