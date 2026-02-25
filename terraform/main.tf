terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================================
# IAM Role for Lambda
# ============================================================
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ============================================================
# Lambda Function - ZIP deployment (pre-built bootstrap binary)
# ============================================================
resource "aws_lambda_function" "ai_lambda_zip" {
  count = var.deploy_method == "zip" ? 1 : 0

  function_name = var.project_name
  role          = aws_iam_role.lambda_role.arn
  handler       = "bootstrap"
  runtime       = "provided.al2023"
  architectures = ["x86_64"]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = "${path.module}/../dist/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/lambda.zip")

  environment {
    variables = {
      ANTHROPIC_API_KEY   = var.anthropic_api_key
      OPENAI_API_KEY      = var.openai_api_key
      DEFAULT_MODEL       = var.default_model
      ALEXA_SYSTEM_PROMPT = var.alexa_system_prompt
    }
  }
}

# ============================================================
# Lambda Function - Docker deployment
# ============================================================
resource "aws_lambda_function" "ai_lambda_docker" {
  count = var.deploy_method == "docker" ? 1 : 0

  function_name = var.project_name
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = var.ecr_image_uri
  architectures = ["x86_64"]
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  environment {
    variables = {
      ANTHROPIC_API_KEY   = var.anthropic_api_key
      OPENAI_API_KEY      = var.openai_api_key
      DEFAULT_MODEL       = var.default_model
      ALEXA_SYSTEM_PROMPT = var.alexa_system_prompt
    }
  }
}

# ============================================================
# Lambda Function URL (HTTP endpoint - no API Gateway/ALB needed)
# ============================================================
resource "aws_lambda_function_url" "ai_lambda_url_zip" {
  count = var.deploy_method == "zip" ? 1 : 0

  function_name      = aws_lambda_function.ai_lambda_zip[0].function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type", "x-api-key", "authorization", "anthropic-version"]
    max_age       = 86400
  }
}

resource "aws_lambda_function_url" "ai_lambda_url_docker" {
  count = var.deploy_method == "docker" ? 1 : 0

  function_name      = aws_lambda_function.ai_lambda_docker[0].function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type", "x-api-key", "authorization", "anthropic-version"]
    max_age       = 86400
  }
}

# ============================================================
# CloudWatch Log Group
# ============================================================
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}"
  retention_in_days = 14
}
