module "digitalocean" {
  source = "./digitalocean"

  project_name         = var.project_name
  region               = var.region
  droplet_size         = var.droplet_size
  ssh_keys             = var.ssh_keys
  spaces_region        = var.spaces_region
  create_spaces_bucket = var.create_spaces_bucket
  domain               = var.domain
  oci_embed_public_ip  = var.oci_embed_public_ip
  oci_worker_public_ip = var.oci_worker_public_ip
}
