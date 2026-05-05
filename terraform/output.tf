
#__________________
# Outputs
#__________________
output "instance_ip" {
  value = aws_eip.learning_eip.public_ip
}
