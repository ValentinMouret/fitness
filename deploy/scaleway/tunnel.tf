moved {
  from = cloudflare_zero_trust_tunnel_cloudflared.deployment
  to   = cloudflare_zero_trust_tunnel_cloudflared.fitness
}

moved {
  from = cloudflare_zero_trust_tunnel_cloudflared_config.deployment
  to   = cloudflare_zero_trust_tunnel_cloudflared_config.fitness
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "fitness" {
  account_id = var.cloudflare_account_id
  name       = "fitness-deployment"
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "fitness" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.fitness.id
  config = {
    ingress = [
      {
        hostname = var.app_hostname
        service  = "http://127.0.0.1:5174"
      },
      {
        hostname = var.deployment_hostname
        service  = "ssh://127.0.0.1:22"
      },
      { service = "http_status:404" }
    ]
  }
  depends_on = [cloudflare_zero_trust_access_application.deployment]
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "fitness" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.fitness.id
}

resource "cloudflare_dns_record" "app" {
  zone_id = var.cloudflare_zone_id
  name    = var.app_hostname
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.fitness.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "deployment" {
  zone_id    = var.cloudflare_zone_id
  name       = var.deployment_hostname
  type       = "CNAME"
  content    = "${cloudflare_zero_trust_tunnel_cloudflared.fitness.id}.cfargotunnel.com"
  proxied    = true
  ttl        = 1
  depends_on = [cloudflare_zero_trust_tunnel_cloudflared_config.fitness]
}

# CI reaches SSH only with this service token.
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
