terraform {
  backend "local" {}

  required_version = ">= 1.5, < 2.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28.1"
    }
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.89.0"
    }
  }
}

provider "cloudflare" {}

provider "scaleway" {
  zone   = var.zone
  region = join("-", slice(split("-", var.zone), 0, 2))
}
