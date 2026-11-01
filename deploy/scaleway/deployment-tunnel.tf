variable "cloudflare_account_id" {
  type    = string
  default = "0e118ed3015cdf0483d4d35ffc6275cc"
}

variable "cloudflare_zone_id" {
  type    = string
  default = "7f33a7bdf6ea6d28d2c920695928f09c"
}

variable "deployment_hostname" {
  description = "Dedicated Access-protected SSH hostname for CI deployment."
  type        = string
  default     = "deploy-fitness.valentinmouret.io"
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "deployment" {
  account_id = var.cloudflare_account_id
  name       = "fitness-deployment"
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_access_service_token" "deployment" {
  account_id = var.cloudflare_account_id
  name       = "fitness-github-actions"
  duration   = "8760h"
}

resource "cloudflare_zero_trust_access_policy" "deployment" {
  account_id = var.cloudflare_account_id
  name       = "Fitness deployment service token"
  decision   = "non_identity"
  include = [{
    service_token = {
      token_id = cloudflare_zero_trust_access_service_token.deployment.id
    }
  }]
}

resource "cloudflare_zero_trust_access_application" "deployment" {
  account_id                = var.cloudflare_account_id
  name                      = "Fitness deployment SSH"
  domain                    = var.deployment_hostname
  type                      = "self_hosted"
  app_launcher_visible      = false
  service_auth_401_redirect = true
  policies = [{
    id         = cloudflare_zero_trust_access_policy.deployment.id
    precedence = 1
  }]
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "deployment" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.deployment.id
  config = {
    ingress = [
      {
        hostname = var.deployment_hostname
        service  = "ssh://127.0.0.1:22"
      },
      { service = "http_status:404" }
    ]
  }
  depends_on = [cloudflare_zero_trust_access_application.deployment]
}

resource "cloudflare_dns_record" "deployment" {
  zone_id = var.cloudflare_zone_id
  name    = var.deployment_hostname
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.deployment.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
  depends_on = [
    cloudflare_zero_trust_access_application.deployment,
    cloudflare_zero_trust_tunnel_cloudflared_config.deployment
  ]
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "deployment" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.deployment.id
}

output "deployment_hostname" {
  value = var.deployment_hostname
}

output "deployment_tunnel_token" {
  description = "Install only on the VM; not a CI credential. Keep Terraform state private."
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.deployment.token
  sensitive   = true
}

output "deployment_access_client_id" {
  value     = cloudflare_zero_trust_access_service_token.deployment.client_id
  sensitive = true
}

output "deployment_access_client_secret" {
  value     = cloudflare_zero_trust_access_service_token.deployment.client_secret
  sensitive = true
}

output "deployment_access_expires_at" {
  value = cloudflare_zero_trust_access_service_token.deployment.expires_at
}
