provider "aws" {
    region = "ap-south-1"
}
resource "aws_instance" "redis" {
    count = 5
    ami                    = "ami-007020fd9c84e18c7"
    instance_type          = "t2.medium"
    subnet_id              = "subnet-07c5918859d627e1e"
    vpc_security_group_ids = ["sg-1e994361"]
    key_name               = "redis"
    tags                   = {
        "Name" : "Redis-cluster-testing-${count.index}"
    }

    connection {
    type     = "ssh"
    user     = "ubuntu"
    private_key = file("../../redis.pem")
    host     = self.public_ip
  }

    provisioner "remote-exec" {
      inline = ["echo 'Ready to connect!'"]
    }
}
# resource "aws_instance" "redis_insight" {
#     ami                    = "ami-007020fd9c84e18c7"
#     instance_type          = "t2.micro"
#     subnet_id              = "subnet-07c5918859d627e1e"
#     vpc_security_group_ids = ["sg-1e994361"]
#     key_name               = "redis"
#     tags                   = {
#         "Name" : "Redis-insight"
#     }
# }

output "redis" {
  value = {
    nodes = aws_instance.redis.*
  }
}

locals {
  redis_instances =  aws_instance.redis.*
  instance_details_json = jsonencode(local.redis_instances)
}

resource "local_file" "inventory" {
  depends_on = [ aws_instance.redis]
  filename = "./inventory_raw.json"
  content = "${local.instance_details_json}"
}
# resource "local_file" "inventory" {
#   depends_on = [ aws_instance.redis ]
#   filename = "./inventory.json"
#   content = <<EOT
# {
#   "node1": {
#     "ip": "${aws_instance.redis.0.private_ip}",
#     "port": 6379
#   },
#   "node2": {
#     "ip": "${aws_instance.redis.1.private_ip}",
#     "port": 6379
#   },
#   "node3": {
#     "ip": "${aws_instance.redis.2.private_ip}",
#     "port": 6379
#   },
#   "node4": {
#     "ip": "${aws_instance.redis.3.private_ip}",
#     "port": 6379
#   }
# }  
# EOT
# }

# resource "null_resource" "run_ansible" {
#     depends_on = [ aws_instance.redis ]
#     triggers = {
#       always_run = timestamp()
#     }
#     provisioner "local-exec" {
#         command = "ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook -i '${aws_instance.redis.0.public_ip},${aws_instance.redis.1.public_ip},${aws_instance.redis.2.public_ip},${aws_instance.redis.3.public_ip},' -u ubuntu --private-key ../../redis.pem ../../ansible/multiple/redis.yml"
#     }
# }
