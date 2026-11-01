terraform {
  required_version = ">= 1.5, < 2.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.89.0"
    }
  }
}

provider "scaleway" {
  zone   = var.zone
  region = join("-", slice(split("-", var.zone), 0, 2))
}
