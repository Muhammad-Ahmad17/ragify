output "droplet_ip" {
  value = module.digitalocean.droplet_ip
}

output "spaces_bucket" {
  value = module.digitalocean.spaces_bucket
}

output "oci_embed_ip" {
  value = var.oci_embed_public_ip
}

output "oci_worker_ip" {
  value = var.oci_worker_public_ip
}

output "deploy_hosts" {
  value = {
    do_droplet = module.digitalocean.droplet_ip
    oci_embed  = var.oci_embed_public_ip
    oci_worker = var.oci_worker_public_ip
  }
}
