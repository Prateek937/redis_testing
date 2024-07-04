provider "google" {
  credentials = file("terraform_gcp.json")
  project = var.project
  region  = var.region
}

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
}

resource "google_compute_firewall" "firewall" {
  name    = "gritfy-firewall-externalssh"
  network = "default"
  allow {
    protocol = "tcp"
    ports    = ["22", "6379", "16379"]
  }
  source_ranges = ["0.0.0.0/0"] # Not So Secure. Limit the Source Range
  target_tags   = ["externalssh"]
}

# We create a public IP address for our google compute instance to utilize
resource "google_compute_address" "static" {
  count = var.max
  name = "redis-${count.index}"
  project = var.project
  region = var.region
  depends_on = [ google_compute_firewall.firewall ]
}

resource "google_compute_instance" "redis" {
  count = var.max
  name         = "redis-${count.index}"
  machine_type = "e2-medium"
  zone         = "${var.region}-a"
  tags         = ["externalssh","webserver"]
  boot_disk {
    initialize_params {
      image = "rhel-cloud/rhel-9"
      # image = "ubuntu-os-cloud/ubuntu-2004-lts"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.static[count.index].address
    }
  }
  # Ensure firewall rule is provisioned before server, so SSH doesn't fail.
  depends_on = [ google_compute_firewall.firewall]
  metadata = {
    sshKeys = "ubuntu:${tls_private_key.ssh.public_key_openssh}"
  }
  # metadata_startup_script = "echo 'root:password@54321@123@@' | chpasswd;echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config;echo 'PermitRootLogin yes' >>  /etc/ssh/sshd_config"
}

resource "null_resource" "check_connection" {
  count = var.max
  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "ubuntu"
      host        = google_compute_instance.redis[count.index].network_interface[0].access_config[0].nat_ip
      private_key = tls_private_key.ssh.private_key_pem
    }
    inline = [
      "echo Connected!"
    ]
  }
}



resource "local_file" "redis" {
  content = tls_private_key.ssh.private_key_openssh
  filename = "../../../redisgcp.pem"
}
resource "local_file" "redis_pub" {
  content = tls_private_key.ssh.public_key_openssh
  filename = "../../../redisgcppub.pem"
}


resource "null_resource" "set_permissions" {
  depends_on = [local_file.redis]
  triggers = {
    always_run = timestamp()
  }
  provisioner "local-exec" {
    command = "chmod 400 ${local_file.redis.filename}"
  }
}

locals {
  redis_instances       = google_compute_instance.redis.*
  instance_details_json = jsonencode(local.redis_instances)
}

resource "local_file" "ip" {
  depends_on = [google_compute_instance.redis]
  filename   = "./inventory_raw.json"
  content    = local.instance_details_json
}

output "redis_ips" {
  value = [for vm in google_compute_instance.redis : vm.network_interface.0.access_config.0.nat_ip]
}