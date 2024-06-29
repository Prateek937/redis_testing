variable "region" {
    type = string
    default = "asia-south1"
}
variable "project" {
    type = string
    default = "jungle-deploy"
}
variable "access_token" {
    type = string
    default = "ya29.a0AXooCgtqxMMdjJVAFFLfai2bJL9oD1N1Zg_c0e4J18IkruRjm7JIizW4tUZeGgTtAeVbfGSdhhoIpd1kPg4JYp7dzZsFpmKpSFlkk4m4M8BiPYWvDOU3FpFTKUXSaorPy2xhjmXSEF8H9jAdK41g-uVT2zb91n9eSUofaCgYKASsSARISFQHGX2MiXQnWrIJ2ryQfizC3hyfwxg0171"
}
variable "email" {
    type = string
    default = "gcp-deploy@jungle-deploy.iam.gserviceaccount.com"
}
variable "privatekeypath" {
    type = string
    default = "~/.ssh/id_rsa"
}
variable "publickeypath" {
    type = string
    default = "~/.ssh/id_rsa.pub"
}

variable "max" {
    type = number
    default = 4
}
