variable "ssh_public_key" {
  description = "Operator key; Scaleway installs project keys for root."
  type        = string
}

variable "deploy_ssh_public_key" {
  description = "CI key for fitness-deploy; read on first boot only."
  type        = string
}

variable "ssh_allowed_cidrs" {
  description = "Break-glass direct SSH sources. CI and the app use the tunnel."
  type        = set(string)
  default     = []
}

variable "cloudflare_account_id" {
  type    = string
  default = "0e118ed3015cdf0483d4d35ffc6275cc"
}

variable "cloudflare_zone_id" {
  type    = string
  default = "7f33a7bdf6ea6d28d2c920695928f09c"
}

variable "app_hostname" {
  type    = string
  default = "fitness.valentinmouret.io"
}

variable "deployment_hostname" {
  type    = string
  default = "deploy-fitness.valentinmouret.io"
}

variable "backup_bucket" {
  type    = string
  default = "fitness-backups-valentinmouret"
}
