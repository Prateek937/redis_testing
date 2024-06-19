#!/usr/bin/bash


read -p "max: " max
terraform apply -var max=$max -auto-approve
node configure.js
