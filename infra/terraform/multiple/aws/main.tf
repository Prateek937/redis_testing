provider "aws" {
  region = "ap-south-1"
}
variable "max" {
  type    = number
  default = 5
}
resource "aws_instance" "redis" {
  count                  = var.max
  ami                    = "ami-007020fd9c84e18c7"
  # instance_type          = "t2.xlarge"
  instance_type          = "t2.medium"
  subnet_id              = "subnet-07c5918859d627e1e"
  vpc_security_group_ids = ["sg-1e994361"]
  key_name               = "redis"
  tags = {
    "Name" : "Redis-cluster-testing-${count.index}"
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = file("../../../redisaws.pem")
    host        = self.public_ip
  }

  provisioner "remote-exec" {
    inline = ["echo 'Ready to connect!'"]
  }
}

output "redis" {
  value = {
    nodes = aws_instance.redis.*
  }
}

locals {
  redis_instances       = aws_instance.redis.*
  instance_details_json = jsonencode(local.redis_instances)
}

resource "local_file" "inventory" {
  depends_on = [aws_instance.redis]
  filename   = "./inventory_raw.json"
  content    = local.instance_details_json
}
