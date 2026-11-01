output "server_id" {
  value = scaleway_instance_server.fitness.id
}

output "ipv6_address" {
  value = one([for ip in scaleway_instance_server.fitness.public_ips : ip.address if ip.family == "inet6"])
}

output "tunnel_token" {
  value     = data.cloudflare_zero_trust_tunnel_cloudflared_token.fitness.token
  sensitive = true
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

output "backup_access_key" {
  value = scaleway_iam_api_key.backup.access_key
}

output "backup_secret_key" {
  value     = scaleway_iam_api_key.backup.secret_key
  sensitive = true
}
