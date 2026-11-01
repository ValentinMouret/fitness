variable "zone" {
  description = "Availability zone; check Stardust stock before applying."
  type        = string
  default     = "pl-waw-2"

  validation {
    condition     = can(regex("^(fr-par|nl-ams|pl-waw)-[1-3]$", var.zone))
    error_message = "Use a Scaleway Instance availability zone."
  }
}

variable "ssh_public_key" {
  description = "Public SSH key registered in the Scaleway project for root administration; never pass the private key."
  type        = string

  validation {
    condition     = can(regex("^ssh-(ed25519|rsa) [A-Za-z0-9+/=]+", trimspace(var.ssh_public_key)))
    error_message = "Provide an OpenSSH ed25519 or RSA public key."
  }
}

variable "ssh_allowed_cidrs" {
  description = "Administrator source CIDRs. IPv6-only deployment requires a reachable IPv6 administrator address."
  type        = set(string)

  validation {
    condition = length(var.ssh_allowed_cidrs) > 0 && alltrue([
      for cidr in var.ssh_allowed_cidrs : can(cidrhost(cidr, 0)) && !contains(["0.0.0.0/0", "::/0"], cidr)
    ])
    error_message = "Provide at least one restricted administrator CIDR, not a world-open range."
  }
}

variable "allocate_ipv4" {
  description = "Paid IPv4 fallback for networks without IPv6; leave false for minimum recurring cost."
  type        = bool
  default     = false
}
