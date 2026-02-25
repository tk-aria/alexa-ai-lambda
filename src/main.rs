mod ai_handler;
mod alexa_handler;
mod models;

use lambda_http::{run, service_fn, Body, Error, Request, Response};
use tracing_subscriber::EnvFilter;

async fn handler(event: Request) -> Result<Response<Body>, Error> {
    let method = event.method().as_str().to_uppercase();
    let path = event.uri().path().to_string();

    tracing::info!(method = %method, path = %path, "Incoming request");

    // Parse body
    let body_bytes = event.body().as_ref();
    let body_str = std::str::from_utf8(body_bytes).unwrap_or("");
    let body_json: serde_json::Value = serde_json::from_str(body_str).unwrap_or_default();

    // Alexa request detection
    if method == "POST" && is_alexa_request(&body_json) {
        return alexa_handler::handle_alexa_request(&body_json).await;
    }

    // Health check
    if path == "/" || path == "/health" {
        if method == "GET" {
            return json_response(200, &serde_json::json!({
                "status": "ok",
                "service": "alexa-ai-lambda",
                "runtime": "rust",
                "endpoints": {
                    "openai": "/v1/chat/completions",
                    "anthropic": "/v1/messages",
                    "alexa": "/ (POST with Alexa request body)"
                }
            }));
        }
    }

    if method != "POST" {
        return json_response(405, &serde_json::json!({
            "error": { "message": "Method not allowed", "type": "invalid_request_error" }
        }));
    }

    // Route by path
    match path.as_str() {
        "/v1/chat/completions" => ai_handler::handle_openai_format(&body_json).await,
        "/v1/messages" => ai_handler::handle_anthropic_format(&body_json).await,
        _ => {
            // Auto-detect format
            if let Some(format) = ai_handler::detect_format(&body_json) {
                match format {
                    ai_handler::ApiFormat::OpenAI => {
                        ai_handler::handle_openai_format(&body_json).await
                    }
                    ai_handler::ApiFormat::Anthropic => {
                        ai_handler::handle_anthropic_format(&body_json).await
                    }
                }
            } else {
                json_response(400, &serde_json::json!({
                    "error": {
                        "message": "Could not determine API format. Use /v1/chat/completions for OpenAI or /v1/messages for Anthropic format.",
                        "type": "invalid_request_error"
                    }
                }))
            }
        }
    }
}

fn is_alexa_request(body: &serde_json::Value) -> bool {
    body.get("version").is_some()
        && body.get("session").is_some()
        && body.get("request").is_some()
        && body["request"]["type"].as_str().map_or(false, |t| {
            matches!(t, "LaunchRequest" | "IntentRequest" | "SessionEndedRequest")
        })
}

pub fn json_response(
    status: u16,
    body: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let resp = Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_string(body)?))
        .map_err(Box::new)?;
    Ok(resp)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .with_target(false)
        .without_time()
        .init();

    run(service_fn(handler)).await
}
