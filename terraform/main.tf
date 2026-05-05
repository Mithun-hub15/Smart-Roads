# ────────────────────────────────────────────────
# VPC & Networking (secure baseline)
# ────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "learning-vpc" }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "learning-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "us-east-1a"

  tags = { Name = "public-subnet" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = { Name = "public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
#___________________________________
# Security Groups
#___________________________________

resource "aws_security_group" "ec2_sg" {
  name        = "ec2-inbound"
  description = "allow http/s and ssh"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "ssh port open"
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "http port open"
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "https port open"
  }
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "grafana port open"
  }
  ingress {
    from_port   = 9000
    to_port     = 9000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "Prometheus port open"

  }
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "cAdvisor port open"
  }
  ingress {
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "grafana port open"
  }
  ingress {
    from_port   = 3300
    to_port     = 3300
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    # ipv6_cidr_blocks = ["${var.my_ip}/128"]
    description = "SmartRoads port open"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "opend all ports for outbound"
  }
  tags = { Name = "ec2-sg1" }
}

#__________________
# Key Pair
#__________________

resource "aws_key_pair" "deployer" {
  key_name   = "deployer-key"
  public_key = file("/home/mithun/.ssh/ec2-key.pub")
}

#__________________
# EC2 Instance & Elastic  IP
#__________________
resource "aws_instance" "learning" {
  ami                    = "ami-0ec10929233384c7f" # ubuntu us-east-1
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  key_name               = aws_key_pair.deployer.key_name

  root_block_device {
    volume_size = 9
    volume_type = "gp3"
  }



  tags = {
    Name = "EC2-Learning"
  }
}

#Elastic IP

resource "aws_eip" "learning_eip" {
  domain = "vpc"
  tags   = { Name = "learning-eip" }
}

# Associate EIP with the instance
resource "aws_eip_association" "eip_assoc" {
  instance_id   = aws_instance.learning.id
  allocation_id = aws_eip.learning_eip.id
}



