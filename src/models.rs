use serde::{Deserialize, Serialize};

// ============================================================
// OpenAI types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct OpenAIRequest {
    pub model: Option<String>,
    pub messages: Option<Vec<OpenAIMessage>>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct OpenAIResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<OpenAIChoice>,
    pub usage: OpenAIUsage,
}

#[derive(Debug, Serialize)]
pub struct OpenAIChoice {
    pub index: u32,
    pub message: OpenAIMessage,
    pub finish_reason: String,
}

#[derive(Debug, Serialize)]
pub struct OpenAIUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ============================================================
// Anthropic types
// ============================================================

#[derive(Debug, Deserialize)]
pub struct AnthropicRequest {
    pub model: Option<String>,
    pub messages: Option<Vec<AnthropicMessage>>,
    pub system: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f64>,
    pub stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicMessage {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicResponse {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub response_type: Option<String>,
    pub role: Option<String>,
    pub content: Option<Vec<AnthropicContent>>,
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub usage: Option<AnthropicUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
}

// ============================================================
// Anthropic API request payload (outgoing)
// ============================================================

#[derive(Debug, Serialize)]
pub struct AnthropicApiPayload {
    pub model: String,
    pub messages: Vec<AnthropicApiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnthropicApiMessage {
    pub role: String,
    pub content: String,
}

// ============================================================
// OpenAI API request payload (outgoing)
// ============================================================

#[derive(Debug, Serialize)]
pub struct OpenAIApiPayload {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}
