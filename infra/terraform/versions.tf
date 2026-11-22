terraform {
  required_version = ">= 1.9"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # Local state on purpose: no S3/DynamoDB backend, so nothing is left behind after destroy.
}

provider "aws" {
  region              = "ap-southeast-2"
  profile             = "warehouse"
  allowed_account_ids = ["727965304944"]

  default_tags {
    tags = {
      project = "woc"
      ttl     = "destroy-today"
    }
  }
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "alert_email" {
  type        = string
  default     = ""
  description = "Optional: adds an email notification to the USD 10 budget. Left empty by default."
}

locals {
  name       = "woc"
  account_id = "727965304944"
  azs        = ["ap-southeast-2a", "ap-southeast-2b"]
}
