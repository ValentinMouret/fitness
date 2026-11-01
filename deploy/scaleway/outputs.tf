output "server_id" {
  value = scaleway_instance_server.fitness.id
}

output "ipv6_address" {
  description = "Use this full host address for SSH and a proxied Cloudflare AAAA record."
  value       = one([for ip in scaleway_instance_server.fitness.public_ips : ip.address if ip.family == "inet6"])
}

output "ipv4_address" {
  value = one(scaleway_instance_ip.ipv4[*].address)
}
