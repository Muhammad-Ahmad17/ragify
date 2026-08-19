output "droplet_ip" {
  value = digitalocean_droplet.app.ipv4_address
}

output "droplet_id" {
  value = digitalocean_droplet.app.id
}

output "spaces_bucket" {
  value = length(digitalocean_spaces_bucket.backups) > 0 ? digitalocean_spaces_bucket.backups[0].name : null
}

output "spaces_endpoint" {
  value = length(digitalocean_spaces_bucket.backups) > 0 ? "${digitalocean_spaces_bucket.backups[0].region}.digitaloceanspaces.com" : null
}
