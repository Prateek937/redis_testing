resource "aws_instance" "vm1" {
  security_groups = []
  ami = "..."
  instance_type = "t2.micro"
  subnet_id = "id"
  hibernation = true
  ebs_block_device =aws_ebs_volume.name.id
  tags = {
    "Name" : "testVM"
    "purpose": "testing"
  }
}

resource "aws_ebs_volume" "name" {
  size = 20
}