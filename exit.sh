#!/usr/bin/bash
read -p "cloud: " cloud
rm -rf ./logs
terraform -chdir=./infra/terraform/multiple/$cloud destroy -auto-approve