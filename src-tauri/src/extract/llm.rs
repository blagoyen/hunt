use crate::extract::ExtractedAttrs;
use serde::Deserialize;

#[derive(Deserialize, Debug, Default)]
struct LlmResponse {
    model: Option<String>,
    storage: Option<i64>,
    battery_health: Option<i64>,
    icloud_locked: Option<bool>,
    carrier_locked: Option<bool>,
    screen_replaced: Option<bool>,
    damage: Option<Vec<String>>,
}

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

pub async fn extract_with_llm(
    title: &str,
    description: &str,
    image_paths: &[String],
    provider: &str,
    model: &str,
    api_key: &str,
) -> Option<ExtractedAttrs> {
    let prompt = format!(
        "Extract structured attributes from this iPhone listing. Return ONLY valid JSON, no markdown.\n\
         Schema: {{\"model\": string|null, \"storage\": number|null, \"battery_health\": number|null, \"icloud_locked\": boolean|null, \"carrier_locked\": boolean|null, \"screen_replaced\": boolean|null, \"damage\": [string]}}\n\
         Damage tags allowed: screen, battery, back, faceid, camera, water, no_power, working.\n\
         Title: {}\nDescription: {}\nJSON:",
        title, description
    );

    // Encode images as base64
    let mut b64_images: Vec<String> = Vec::new();
    for p in image_paths {
        if let Ok(bytes) = std::fs::read(p) {
            b64_images.push(BASE64.encode(&bytes));
        }
    }
    let has_images = !b64_images.is_empty();

    let (url, body, headers) = match provider {
        "ollama" => {
            let mut b = serde_json::json!({
                "model": model,
                "prompt": prompt,
                "stream": false,
                "format": "json"
            });
            if has_images {
                b["images"] = serde_json::json!(b64_images);
            }
            (format!("http://localhost:11434/api/generate"), b, vec![])
        }
        "groq" => {
            // OpenAI vision format: content array with text + image_url
            let mut content: Vec<serde_json::Value> = vec![serde_json::json!({"type": "text", "text": prompt})];
            for b64 in &b64_images {
                content.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": {"url": format!("data:image/jpeg;base64,{}", b64)}
                }));
            }
            let msg_content = if has_images {
                serde_json::json!(content)
            } else {
                serde_json::json!(prompt)
            };
            (
                "https://api.groq.com/openai/v1/chat/completions".to_string(),
                serde_json::json!({
                    "model": model,
                    "messages": [{"role": "user", "content": msg_content}],
                    "response_format": {"type": "json_object"}
                }),
                vec![("Authorization".to_string(), format!("Bearer {}", api_key))],
            )
        }
        "gemini" => {
            let mut parts: Vec<serde_json::Value> = vec![serde_json::json!({"text": prompt})];
            for b64 in &b64_images {
                parts.push(serde_json::json!({
                    "inlineData": {"mimeType": "image/jpeg", "data": b64}
                }));
            }
            (
                format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key),
                serde_json::json!({
                    "contents": [{"parts": parts}],
                    "generationConfig": {"responseMimeType": "application/json"}
                }),
                vec![],
            )
        }
        _ => return None,
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .ok()?;

    let mut req = client.post(&url).json(&body);
    for (k, v) in headers {
        req = req.header(k, v);
    }

    let resp = req.send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;

    // Extract JSON from response
    let json_str = extract_json(&text)?;
    let parsed: LlmResponse = serde_json::from_str(&json_str).ok()?;

    let mut attrs = ExtractedAttrs::default();
    attrs.model = parsed.model;
    attrs.storage_gb = parsed.storage;
    attrs.battery_health = parsed.battery_health;
    attrs.icloud_locked = parsed.icloud_locked;
    attrs.carrier_locked = parsed.carrier_locked;
    attrs.screen_replaced = parsed.screen_replaced;
    attrs.damage = parsed.damage.unwrap_or_default();
    attrs.confidence = 0.85;
    attrs.extractor = format!("llm:{}", provider);
    Some(attrs)
}

fn extract_json(text: &str) -> Option<String> {
    // Ollama returns {"response": "..."}, OpenAI returns choices[0].message.content, Gemini returns candidates[0].content.parts[0].text
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(s) = v.get("response").and_then(|x| x.as_str()) {
            return Some(s.to_string());
        }
        if let Some(s) = v
            .get("choices")
            .and_then(|x| x.get(0))
            .and_then(|x| x.get("message"))
            .and_then(|x| x.get("content"))
            .and_then(|x| x.as_str())
        {
            return Some(s.to_string());
        }
        if let Some(s) = v
            .get("candidates")
            .and_then(|x| x.get(0))
            .and_then(|x| x.get("content"))
            .and_then(|x| x.get("parts"))
            .and_then(|x| x.get(0))
            .and_then(|x| x.get("text"))
            .and_then(|x| x.as_str())
        {
            return Some(s.to_string());
        }
    }
    // Fallback: find first { ... } in text
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}
