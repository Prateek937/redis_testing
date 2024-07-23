#!/bin/bash

ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.141 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.16 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.113 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.154 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.89 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.87 "sudo poweroff"
ssh -o StrictHostKeyChecking=accept-new  -i infra/redisaws.pem ubuntu@172.31.5.157 "sudo poweroff"
sudo poweroff