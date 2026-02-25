use lambda_http::{Body, Error, Response};
use serde_json::json;
use std::env;

const MAX_HISTORY: usize = 10;

/// Handle Alexa request
pub async fn handle_alexa_request(
    body: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let request_type = body["request"]["type"].as_str().unwrap_or("");
    let attributes = body["session"]["attributes"].clone();

    match request_type {
        "LaunchRequest" => build_alexa_response(
            "AI会話アシスタントへようこそ。何でも聞いてください。",
            false,
            &attributes,
        ),
        "IntentRequest" => handle_intent(&body["request"], &attributes).await,
        "SessionEndedRequest" => build_alexa_response("", true, &json!({})),
        _ => build_alexa_response(
            "すみません、そのリクエストには対応していません。",
            false,
            &attributes,
        ),
    }
}

async fn handle_intent(
    request: &serde_json::Value,
    attributes: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let intent_name = request["intent"]["name"].as_str().unwrap_or("");

    match intent_name {
        "ChatIntent" | "AMAZON.FallbackIntent" => {
            let user_text = request["intent"]["slots"]["query"]["value"]
                .as_str()
                .or_else(|| request["intent"]["slots"]["message"]["value"].as_str())
                .unwrap_or("Hello");

            handle_chat_message(user_text, attributes).await
        }
        "AMAZON.HelpIntent" => build_alexa_response(
            "何でも質問してください。AIが回答します。会話を終了するには「ストップ」と言ってください。",
            false,
            attributes,
        ),
        "AMAZON.StopIntent" | "AMAZON.CancelIntent" => {
            build_alexa_response("さようなら。またお話しましょう。", true, &json!({}))
        }
        _ => build_alexa_response("すみません、もう一度お願いします。", false, attributes),
    }
}

async fn handle_chat_message(
    user_text: &str,
    attributes: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let mut history: Vec<serde_json::Value> = attributes
        .get("conversationHistory")
        .and_then(|h| serde_json::from_value(h.clone()).ok())
        .unwrap_or_default();

    history.push(json!({ "role": "user", "content": user_text }));

    // Trim history
    while history.len() > MAX_HISTORY * 2 {
        history.remove(0);
    }

    match get_ai_response(&history).await {
        Ok(ai_response) => {
            history.push(json!({ "role": "assistant", "content": ai_response }));

            let mut new_attrs = attributes.clone();
            if let Some(obj) = new_attrs.as_object_mut() {
                obj.insert("conversationHistory".to_string(), json!(history));
            } else {
                new_attrs = json!({ "conversationHistory": history });
            }

            build_alexa_response(&ai_response, false, &new_attrs)
        }
        Err(e) => {
            tracing::error!(error = %e, "AI API error");
            build_alexa_response(
                "すみません、AIからの応答を取得できませんでした。もう一度お試しください。",
                false,
                attributes,
            )
        }
    }
}

async fn get_ai_response(history: &[serde_json::Value]) -> Result<String, Error> {
    let model =
        env::var("DEFAULT_MODEL").unwrap_or_else(|_| "claude-sonnet-4-20250514".to_string());
    let backend = get_backend_for_model(&model);

    let system_prompt = env::var("ALEXA_SYSTEM_PROMPT").unwrap_or_else(|_| {
        "You are a helpful voice assistant accessed through Alexa. Keep responses concise and conversational, under 3 sentences when possible. Respond in the same language as the user.".to_string()
    });

    let messages: Vec<serde_json::Value> = history
        .iter()
        .map(|m| {
            json!({
                "role": m["role"].as_str().unwrap_or("user"),
                "content": m["content"].as_str().unwrap_or("")
            })
        })
        .collect();

    if backend == "anthropic" {
        call_anthropic_for_alexa(&model, &system_prompt, &messages).await
    } else {
        call_openai_for_alexa(&model, &system_prompt, &messages).await
    }
}

async fn call_anthropic_for_alexa(
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
) -> Result<String, Error> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY not set")?;

    let payload = json!({
        "model": model,
        "messages": messages,
        "system": system_prompt,
        "max_tokens": 300,
        "temperature": 0.7,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .timeout(std::time::Duration::from_secs(25))
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Anthropic API error ({}): {}", status, text).into());
    }

    let parsed: serde_json::Value = serde_json::from_str(&text)?;
    Ok(parsed["content"][0]["text"]
        .as_str()
        .unwrap_or("No response received.")
        .to_string())
}

async fn call_openai_for_alexa(
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
) -> Result<String, Error> {
    let api_key =
        env::var("OPENAI_API_KEY").map_err(|_| "OPENAI_API_KEY not set")?;

    let mut all_messages = vec![json!({ "role": "system", "content": system_prompt })];
    all_messages.extend_from_slice(messages);

    let payload = json!({
        "model": model,
        "messages": all_messages,
        "max_tokens": 300,
        "temperature": 0.7,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&payload)
        .timeout(std::time::Duration::from_secs(25))
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?;

    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status, text).into());
    }

    let parsed: serde_json::Value = serde_json::from_str(&text)?;
    Ok(parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("No response received.")
        .to_string())
}

fn get_backend_for_model(model: &str) -> &'static str {
    let lower = model.to_lowercase();
    if lower.starts_with("gpt-") || lower.starts_with("o1") || lower.starts_with("o3") {
        "openai"
    } else {
        "anthropic"
    }
}

fn build_alexa_response(
    speech_text: &str,
    should_end_session: bool,
    session_attributes: &serde_json::Value,
) -> Result<Response<Body>, Error> {
    let body = json!({
        "version": "1.0",
        "sessionAttributes": session_attributes,
        "response": {
            "outputSpeech": {
                "type": "PlainText",
                "text": speech_text,
            },
            "card": {
                "type": "Simple",
                "title": "AI Chat",
                "content": speech_text,
            },
            "reprompt": if should_end_session {
                serde_json::Value::Null
            } else {
                json!({
                    "outputSpeech": {
                        "type": "PlainText",
                        "text": "他に何か聞きたいことはありますか？",
                    }
                })
            },
            "shouldEndSession": should_end_session,
        }
    });

    crate::json_response(200, &body)
}
