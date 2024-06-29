provider "aws" {
  region = "ap-south-1"
}

resource "aws_instance" "redis" {
  ami                    = "ami-007020fd9c84e18c7"
  instance_type          = "t2.xlarge"
  subnet_id              = "subnet-07c5918859d627e1e"
  vpc_security_group_ids = ["sg-1e994361"]
  key_name               = "redis"
  tags = {
    "Name" : "Redis-cluster-testing-sinngle"
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = file("../../redis.pem")
    host        = self.public_ip
  }

  provisioner "remote-exec" {
    inline = ["echo 'Ready to connect!'"]
  }
}

resource "local_file" "inventory" {
  depends_on = [aws_instance.redis]
  filename   = "./inventory.json"
  content    = <<EOT
  {
    "node1": {
      "ip": "${aws_instance.redis.public_ip}",
      "port": 6379
    },
    "node2": {
      "ip": "${aws_instance.redis.public_ip}",
      "port": 6380
    },
    "node3": {
      "ip": "${aws_instance.redis.public_ip}",
      "port": 6381
    },
    "node4": {
      "ip": "${aws_instance.redis.public_ip}",
      "port": 6382
    }
  }
  EOT
}

resource "null_resource" "run_ansible" {
  depends_on = [aws_instance.redis]
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = "ANSIBLE_HOST_KEY_CHECKING=FALSE ansible-playbook -i '${aws_instance.redis.public_ip},' -u ubuntu --private-key ../../redis.pem ../../ansible/single/redis.yml"
  }
}