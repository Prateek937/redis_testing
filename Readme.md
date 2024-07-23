# Deploy the Redis Cluster

    ./init.sh
The command will ask for input.
> 1. max: number (redis vms to deploy)
> 2. cloud: string (aws/gcp)

When the command finishes a directory called './logs/ansible' will be created. This directory consists number of ansible log files names the ips. Now pick any one of the IP and connect to that. 
# Running the script
Now do the following on the connected nodes.
Change the directory to testing.

    cd testing

update the steps into inputs.js file then run the main script

```
node main.js
```

  