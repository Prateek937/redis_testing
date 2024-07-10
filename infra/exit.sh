#!/usr/bin/bash
read -p "cloud: " cloud
rm -rf ./logs
terraform -chdir=./terraform/multiple/$cloud destroy -auto-approve