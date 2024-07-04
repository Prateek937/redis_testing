#!/usr/bin/bash
read -p "cloud: " cloud
terraform -chdir=./$cloud destroy -auto-approve