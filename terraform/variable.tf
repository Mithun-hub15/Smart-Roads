variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
  # default = "c7i-flex.large"
}

#  variable "my_ip" {
#     description = "public ip for ssh"
#     type = string
#     default= "@@@@" #curl ifconfig.me 
#  }
# variable "my_ip_ipv4" {
#     description = "public ipv4 for ssh"
#     type = string
#     default = "49.43.240.248/32"
# }
