resource "scaleway_iam_ssh_key" "fitness" {
  name       = "fitness-administrator"
  public_key = trimspace(var.ssh_public_key)
}

resource "scaleway_instance_ip" "ipv6" {
  type = "routed_ipv6"
}

# All traffic arrives through the outbound Cloudflare tunnel; only break-glass SSH is open.
resource "scaleway_instance_security_group" "fitness" {
  name                    = "fitness"
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"
  stateful                = true

  dynamic "inbound_rule" {
    for_each = var.ssh_allowed_cidrs
    content {
      action   = "accept"
      protocol = "TCP"
      port     = 22
      ip_range = inbound_rule.value
    }
  }

  dynamic "inbound_rule" {
    for_each = toset(["::/0", "0.0.0.0/0"])
    content {
      action   = "accept"
      protocol = "ICMP"
      ip_range = inbound_rule.value
    }
  }
}

resource "scaleway_instance_server" "fitness" {
  name              = "fitness"
  type              = "STARDUST1-S"
  image             = "ubuntu_noble"
  ip_ids            = [scaleway_instance_ip.ipv6.id]
  security_group_id = scaleway_instance_security_group.fitness.id
  protected         = true
  tags              = ["fitness", "terraform"]

  root_volume {
    volume_type           = "l_ssd"
    size_in_gb            = 10
    delete_on_termination = false
  }

  user_data = {
    cloud-init = templatefile("${path.module}/cloud-init.yaml.tftpl", {
      deploy_ssh_public_key = trimspace(var.deploy_ssh_public_key)
    })
  }

  lifecycle {
    prevent_destroy = true
    # Cloud-init only runs on first boot; edits must not touch the live VM.
    ignore_changes = [user_data]
  }
}

resource "scaleway_object_bucket" "backups" {
  name = var.backup_bucket

  lifecycle_rule {
    id      = "expire"
    enabled = true
    expiration {
      days = 30
    }
  }
}

resource "scaleway_iam_application" "backup" {
  name = "fitness-backup"
}

resource "scaleway_iam_policy" "backup" {
  name           = "fitness-backup"
  application_id = scaleway_iam_application.backup.id
  rule {
    project_ids          = [scaleway_object_bucket.backups.project_id]
    permission_set_names = ["ObjectStorageObjectsWrite"]
  }
}

resource "scaleway_iam_api_key" "backup" {
  application_id     = scaleway_iam_application.backup.id
  default_project_id = scaleway_object_bucket.backups.project_id
  description        = "Nightly PostgreSQL dumps from the fitness VM"
}
