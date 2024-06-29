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
  machine_type = "e2-micro"
  zone         = "${var.region}-a"
  tags         = ["externalssh","webserver"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2004-lts"
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
    sshKeys = "ubuntu:${tls_private_key.ssh.private_key_pem}"
  }
  # metadata_startup_script = "echo 'root:password@54321@123@@' | chpasswd;echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config;echo 'PermitRootLogin yes' >>  /etc/ssh/sshd_config"
}

resource "local_file" "redis" {
  content = tls_private_key.ssh.private_key_pem
  filename = "../../../redisgcp.pem"
}

resource "null_resource" "set_permissions" {
  provisioner "local-exec" {
    command = "chmod 400 ${local_file.redis.filename}"
  }

  depends_on = [local_file.redis]
}

locals {
  redis_instances       = google_compute_instance.redis.*
  instance_details_json = jsonencode(local.redis_instances)
}

resource "local_file" "ip" {
  depends_on = [google_compute_instance.redis]
  filename   = "../inventory_raw.json"
  content    = local.instance_details_json
}

output "redis_ips" {
  value = [for vm in google_compute_instance.redis : vm.network_interface.0.access_config.0.nat_ip]
}