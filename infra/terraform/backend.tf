resource "aws_ecr_repository" "api" {
  name         = "woc-api"
  force_delete = true
  depends_on   = [aws_budgets_budget.monthly]
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "woc"
  subnet_ids = aws_subnet.isolated[*].id
}

resource "aws_db_instance" "main" {
  identifier              = "woc-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  storage_type            = "gp3"
  db_name                 = "woc"
  username                = "woc"
  password                = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  multi_az                = false
  publicly_accessible     = false
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 0 # no automated backups, so no snapshots outlive the destroy
  apply_immediately       = true
}

# The full connection string (with password) lives in SSM Parameter Store, never in git or task env.
resource "aws_ssm_parameter" "database_url" {
  name  = "/woc/database-url"
  type  = "SecureString"
  value = "postgresql+asyncpg://woc:${random_password.db.result}@${aws_db_instance.main.address}:5432/woc?ssl=require"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/woc-api"
  retention_in_days = 1
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "woc-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_ssm" {
  name = "woc-read-ssm"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["ssm:GetParameters"], Resource = [aws_ssm_parameter.database_url.arn] }]
  })
}

resource "aws_ecs_cluster" "main" {
  name = "woc"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "woc-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    essential    = true
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]
    environment = [
      { name = "SIM_SEED", value = "42" },
      { name = "SIM_ROBOTS", value = "200" },
      { name = "CORS_ORIGINS", value = "*" },
    ]
    secrets = [{ name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = "ap-southeast-2"
        awslogs-stream-prefix = "api"
      }
    }
  }])
}

resource "aws_lb" "main" {
  name               = "woc-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 300 # WebSocket
}

resource "aws_lb_target_group" "api" {
  name        = "woc-api"
  port        = 8000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id
  health_check {
    path                = "/healthz"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    interval            = 15
  }
  deregistration_delay = 5
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecs_service" "api" {
  name                  = "woc-api"
  cluster               = aws_ecs_cluster.main.id
  task_definition       = aws_ecs_task_definition.api.arn
  desired_count         = 1
  launch_type           = "FARGATE"
  wait_for_steady_state = true

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true # public subnet + public IP instead of a NAT gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http, aws_iam_role_policy_attachment.ecs_execution, aws_iam_role_policy.ecs_ssm]
}
