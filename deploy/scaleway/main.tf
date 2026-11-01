resource "scaleway_iam_ssh_key" "fitness" {
  name       = "fitness-administrator"
  public_key = trimspace(var.ssh_public_key)
}

resource "scaleway_instance_ip" "ipv6" {
  type = "routed_ipv6"
}

resource "scaleway_instance_ip" "ipv4" {
  count = var.allocate_ipv4 ? 1 : 0
  type  = "routed_ipv4"
}

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

  inbound_rule {
    action   = "accept"
    protocol = "TCP"
    port     = 80
  }

  inbound_rule {
    action   = "accept"
    protocol = "TCP"
    port     = 443
  }

  inbound_rule {
    action   = "accept"
    protocol = "ICMP"
  }
}

resource "scaleway_instance_server" "fitness" {
  depends_on = [scaleway_iam_ssh_key.fitness]

  name              = "fitness"
  type              = "STARDUST1-S"
  image             = "ubuntu_noble"
  ip_ids            = concat([scaleway_instance_ip.ipv6.id], scaleway_instance_ip.ipv4[*].id)
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
      ssh_public_key = trimspace(var.ssh_public_key)
    })
  }

  lifecycle {
    prevent_destroy = true
  }
}
