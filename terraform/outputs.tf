output "lambda_function_name" {
  description = "Lambda function name"
  value       = var.deploy_method == "zip" ? aws_lambda_function.ai_lambda_zip[0].function_name : aws_lambda_function.ai_lambda_docker[0].function_name
}

output "lambda_function_url" {
  description = "Lambda Function URL (HTTP endpoint)"
  value       = var.deploy_method == "zip" ? aws_lambda_function_url.ai_lambda_url_zip[0].function_url : aws_lambda_function_url.ai_lambda_url_docker[0].function_url
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = var.deploy_method == "zip" ? aws_lambda_function.ai_lambda_zip[0].arn : aws_lambda_function.ai_lambda_docker[0].arn
}

output "deploy_method" {
  description = "Deployment method used"
  value       = var.deploy_method
}
