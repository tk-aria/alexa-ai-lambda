variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "alexa-ai-lambda"
}

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "ap-northeast-1"
}

variable "deploy_method" {
  description = "Deployment method: zip or docker"
  type        = string
  default     = "zip"
  validation {
    condition     = contains(["zip", "docker"], var.deploy_method)
    error_message = "deploy_method must be 'zip' or 'docker'"
  }
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "default_model" {
  description = "Default AI model to use"
  type        = string
  default     = "claude-sonnet-4-20250514"
}

variable "alexa_system_prompt" {
  description = "System prompt for Alexa conversations"
  type        = string
  default     = "You are a helpful voice assistant accessed through Alexa. Keep responses concise and conversational, under 3 sentences when possible. Respond in the same language as the user."
}

variable "ecr_image_uri" {
  description = "ECR image URI for Docker deployment (required when deploy_method=docker)"
  type        = string
  default     = ""
}
