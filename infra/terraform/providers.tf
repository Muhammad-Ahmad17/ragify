provider "digitalocean" {
  token             = var.do_token
  spaces_access_id  = var.spaces_access_id != "" ? var.spaces_access_id : null
  spaces_secret_key = var.spaces_secret_key != "" ? var.spaces_secret_key : null
}

# OCI provider is only required when managing OCI via Terraform (compartment or
# instance OCIDs set in tfvars). Uncomment and configure ~/.oci/config first:
#
# provider "oci" {}
