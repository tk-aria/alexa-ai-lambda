use crate::models::*;
use lambda_http::{Body, Error, Response};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, PartialEq)]
pub enum ApiFormat {
    OpenAI,
    Anthropic,
}

/// Detect API format from request body
pub fn detect_format(body: &serde_json::Value) -> Option<ApiFormat> {
    let has_messages = body.get("messages").and_then(|v| v.as_array()).is_some();
    if !has_messages {
        return None;
    }
    // Anthropic: has max_tokens
    if body.get("max_tokens").is_some() {
        return Some(ApiFormat::Anthropic);
    }
    // Default: OpenAI
    Some(ApiFormat::OpenAI)
}

/// Handle OpenAI Chat Completion format
pub async fn handle_openai_format(
    body: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let req: OpenAIRequest = serde_json::from_value(body.clone()).unwrap_or(OpenAIRequest {
        model: None,
        messages: None,
        temperature: None,
        max_tokens: None,
        stream: None,
    });

    if req.stream == Some(true) {
        return json_response(400, &serde_json::json!({
            "error": { "message": "Streaming is not supported in Lambda", "type": "invalid_request_error" }
        }));
    }

    let messages = match req.messages {
        Some(ref m) if !m.is_empty() => m,
        _ => {
            return json_response(400, &serde_json::json!({
                "error": { "message": "messages is required and must be a non-empty array", "type": "invalid_request_error" }
            }));
        }
    };

    let model = req
        .model
        .clone()
        .unwrap_or_else(|| default_model());
    let backend = get_backend_for_model(&model);

    if backend == "anthropic" {
        // Convert OpenAI → Anthropic
        let mut system_prompt = String::new();
        let mut anthropic_msgs: Vec<AnthropicApiMessage> = Vec::new();

        for msg in messages {
            if msg.role == "system" {
                if !system_prompt.is_empty() {
                    system_prompt.push('\n');
                }
                system_prompt.push_str(&msg.content);
            } else {
                anthropic_msgs.push(AnthropicApiMessage {
                    role: msg.role.clone(),
                    content: msg.content.clone(),
                });
            }
        }

        let payload = AnthropicApiPayload {
            model: model.clone(),
            messages: anthropic_msgs,
            system: if system_prompt.is_empty() {
                None
            } else {
                Some(system_prompt)
            },
            max_tokens: req.max_tokens.unwrap_or(1024),
            temperature: req.temperature,
        };

        let result = call_anthropic_api(&payload).await?;

        let text = result
            .content
            .as_ref()
            .and_then(|c| c.first())
            .map(|c| c.text.clone())
            .unwrap_or_default();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let input_tokens = result
            .usage
            .as_ref()
            .and_then(|u| u.input_tokens)
            .unwrap_or(0);
        let output_tokens = result
            .usage
            .as_ref()
            .and_then(|u| u.output_tokens)
            .unwrap_or(0);

        let response = OpenAIResponse {
            id: format!(
                "chatcmpl-{}",
                result.id.unwrap_or_else(|| now.to_string())
            ),
            object: "chat.completion".to_string(),
            created: now,
            model: result.model.unwrap_or(model),
            choices: vec![OpenAIChoice {
                index: 0,
                message: OpenAIMessage {
                    role: "assistant".to_string(),
                    content: text,
                },
                finish_reason: map_stop_reason(
                    result.stop_reason.as_deref().unwrap_or("end_turn"),
                ),
            }],
            usage: OpenAIUsage {
                prompt_tokens: input_tokens,
                completion_tokens: output_tokens,
                total_tokens: input_tokens + output_tokens,
            },
        };

        json_response(200, &serde_json::to_value(response)?)
    } else {
        // Call OpenAI directly
        let payload = OpenAIApiPayload {
            model,
            messages: messages.clone(),
            temperature: req.temperature,
            max_tokens: req.max_tokens,
        };

        let result = call_openai_api(&payload).await?;
        json_response(200, &result)
    }
}

/// Handle Anthropic Messages format
pub async fn handle_anthropic_format(
    body: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let req: AnthropicRequest =
        serde_json::from_value(body.clone()).unwrap_or(AnthropicRequest {
            model: None,
            messages: None,
            system: None,
            max_tokens: None,
            temperature: None,
            stream: None,
        });

    if req.stream == Some(true) {
        return json_response(400, &serde_json::json!({
            "error": {
                "type": "invalid_request_error",
                "message": "Streaming is not supported in Lambda"
            }
        }));
    }

    let messages = match req.messages {
        Some(ref m) if !m.is_empty() => m,
        _ => {
            return json_response(400, &serde_json::json!({
                "error": {
                    "type": "invalid_request_error",
                    "message": "messages is required and must be a non-empty array"
                }
            }));
        }
    };

    let model = req
        .model
        .clone()
        .unwrap_or_else(|| default_model());
    let backend = get_backend_for_model(&model);

    if backend == "openai" {
        // Convert Anthropic → OpenAI
        let mut openai_msgs: Vec<OpenAIMessage> = Vec::new();
        if let Some(ref sys) = req.system {
            openai_msgs.push(OpenAIMessage {
                role: "system".to_string(),
                content: sys.clone(),
            });
        }
        for msg in messages {
            let content_str = match &msg.content {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Array(arr) => arr
                    .iter()
                    .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join(""),
                _ => String::new(),
            };
            openai_msgs.push(OpenAIMessage {
                role: msg.role.clone(),
                content: content_str,
            });
        }

        let payload = OpenAIApiPayload {
            model: model.clone(),
            messages: openai_msgs,
            temperature: req.temperature,
            max_tokens: Some(req.max_tokens.unwrap_or(1024)),
        };

        let result = call_openai_api(&payload).await?;

        let choice_text = result["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let finish_reason = result["choices"][0]["finish_reason"]
            .as_str()
            .unwrap_or("stop");

        let resp = serde_json::json!({
            "id": result["id"].as_str().unwrap_or(&format!("msg_{}", now_secs())),
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "text", "text": choice_text }],
            "model": result["model"].as_str().unwrap_or(&model),
            "stop_reason": map_finish_reason(finish_reason),
            "usage": {
                "input_tokens": result["usage"]["prompt_tokens"].as_u64().unwrap_or(0),
                "output_tokens": result["usage"]["completion_tokens"].as_u64().unwrap_or(0),
            }
        });

        json_response(200, &resp)
    } else {
        // Call Anthropic directly
        let anthropic_msgs: Vec<AnthropicApiMessage> = messages
            .iter()
            .map(|m| {
                let content_str = match &m.content {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Array(arr) => arr
                        .iter()
                        .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join(""),
                    _ => String::new(),
                };
                AnthropicApiMessage {
                    role: m.role.clone(),
                    content: content_str,
                }
            })
            .collect();

        let payload = AnthropicApiPayload {
            model,
            messages: anthropic_msgs,
            system: req.system,
            max_tokens: req.max_tokens.unwrap_or(1024),
            temperature: req.temperature,
        };

        let result = call_anthropic_api(&payload).await?;
        json_response(200, &serde_json::to_value(result)?)
    }
}

/// Call Anthropic Messages API
async fn call_anthropic_api(
    payload: &AnthropicApiPayload,
) -> Result<AnthropicResponse, Error> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY environment variable is not set")?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(payload)
        .timeout(std::time::Duration::from_secs(28))
        .send()
        .await
        .map_err(|e| format!("Anthropic API request failed: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read Anthropic response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Anthropic API error ({}): {}", status, text).into());
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse Anthropic response: {e}").into())
}

/// Call OpenAI Chat Completions API
async fn call_openai_api(
    payload: &OpenAIApiPayload,
) -> Result<serde_json::Value, Error> {
    let api_key = env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable is not set")?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {api_key}"))
        .json(payload)
        .timeout(std::time::Duration::from_secs(28))
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read OpenAI response: {e}"))?;

    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status, text).into());
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse OpenAI response: {e}").into())
}

fn get_backend_for_model(model: &str) -> &'static str {
    let lower = model.to_lowercase();
    if lower.starts_with("gpt-") || lower.starts_with("o1") || lower.starts_with("o3") {
        "openai"
    } else {
        "anthropic"
    }
}

fn default_model() -> String {
    env::var("DEFAULT_MODEL").unwrap_or_else(|_| "claude-sonnet-4-20250514".to_string())
}

fn map_stop_reason(reason: &str) -> String {
    match reason {
        "end_turn" => "stop",
        "max_tokens" => "length",
        "stop_sequence" => "stop",
        _ => "stop",
    }
    .to_string()
}

fn map_finish_reason(reason: &str) -> String {
    match reason {
        "stop" => "end_turn",
        "length" => "max_tokens",
        "content_filter" => "end_turn",
        _ => "end_turn",
    }
    .to_string()
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn json_response(
    status: u16,
    body: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    crate::json_response(status, body)
}
