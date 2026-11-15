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

fn join_url(base: &str, path: &str) -> String {
    let b = base.trim_end_matches('/');
    let p = path.trim_start_matches('/');
    if b.is_empty() { path.to_string() } else { format!("{}/{}", b, p) }
}

fn build_request(prompt: &str, image_paths: &[String], cfg: &crate::config::LlmConfig) -> Option<(String, serde_json::Value, Vec<(String, String)>)> {
    let provider = cfg.provider.as_str();
    let model = cfg.model.as_str();
    let api_key = cfg.api_key.as_str();
    let base_url = cfg.base_url.trim();

    // Encode images as base64
    let mut b64_images: Vec<String> = Vec::new();
    for p in image_paths {
        if let Ok(bytes) = std::fs::read(p) {
            b64_images.push(BASE64.encode(&bytes));
        }
    }
    let has_images = !b64_images.is_empty();

    match provider {
        "ollama" => {
            let url = if base_url.is_empty() { "http://localhost:11434/api/generate".to_string() } else if base_url.contains("/api/") { base_url.to_string() } else { join_url(base_url, "api/generate") };
            let mut b = serde_json::json!({
                "model": model,
                "prompt": prompt,
                "stream": false
            });
            if has_images { b["images"] = serde_json::json!(b64_images); }
            Some((url, b, vec![]))
        }
        "gemini" => {
            let mut parts: Vec<serde_json::Value> = vec![serde_json::json!({"text": prompt})];
            for b64 in &b64_images {
                parts.push(serde_json::json!({"inlineData": {"mimeType": "image/jpeg", "data": b64}}));
            }
            let url = if base_url.is_empty() {
                format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key)
            } else if base_url.contains(":generateContent") {
                base_url.to_string()
            } else {
                let bu = base_url.trim_end_matches('/');
                // If user left an OpenAI-style base (e.g. .../v1) while provider is Gemini, ignore it and use default Google endpoint
                let looks_openai_base = bu.ends_with("/v1") || bu.contains("openai") || bu.contains("openrouter") || bu.contains("/chat/completions");
                if looks_openai_base {
                    format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key)
                } else if bu.contains("generativelanguage.googleapis.com") {
                    // allow base like https://generativelanguage.googleapis.com/v1beta
                    format!("{}/models/{}:generateContent?key={}", bu, model, api_key)
                } else {
                    format!("{}/models/{}:generateContent?key={}", bu, model, api_key)
                }
            };
            Some((url, serde_json::json!({"contents": [{"parts": parts}]}), vec![]))
        }
        "groq" | "openai" => {
            let mut content: Vec<serde_json::Value> = vec![serde_json::json!({"type": "text", "text": prompt})];
            for b64 in &b64_images {
                content.push(serde_json::json!({"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", b64)}}));
            }
            let msg_content = if has_images { serde_json::json!(content) } else { serde_json::json!(prompt) };
            let default_base = if provider == "groq" { "https://api.groq.com/openai/v1" } else { "https://api.openai.com/v1" };
            let bu = if base_url.is_empty() { default_base } else { base_url };
            let url = if bu.contains("/chat/completions") { bu.to_string() } else { join_url(bu, "chat/completions") };
            let mut headers = vec![];
            if !api_key.is_empty() { headers.push(("Authorization".to_string(), format!("Bearer {}", api_key))); }
            Some((url, serde_json::json!({"model": model, "messages": [{"role": "user", "content": msg_content}]}), headers))
        }
        _ => None,
    }
}

async fn call_llm(prompt: &str, image_paths: &[String], cfg: &crate::config::LlmConfig, timeout_secs: u64) -> Result<String, String> {
    let (url, body, headers) = build_request(prompt, image_paths, cfg).ok_or_else(|| "Nepoznat ili nepodešen provajder".to_string())?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.post(&url).json(&body);
    for (k, v) in headers { req = req.header(k, v); }
    let resp = req.send().await.map_err(|e| format!("HTTP greška: {}", e))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Čitanje odgovora: {}", e))?;
    if !status.is_success() {
        return Err(format!("{}: {}", status, text.chars().take(500).collect::<String>()));
    }
    extract_json(&text).or_else(|| Some(text.clone())).ok_or_else(|| "Prazan odgovor".to_string())
}

pub async fn extract_with_llm(
    title: &str,
    description: &str,
    image_paths: &[String],
    cfg: &crate::config::LlmConfig,
) -> Option<ExtractedAttrs> {
    let prompt = format!(
        "Extract structured attributes from this iPhone listing. Return ONLY valid JSON, no markdown.\n\
         Schema: {{\"model\": string|null, \"storage\": number|null, \"battery_health\": number|null, \"icloud_locked\": boolean|null, \"carrier_locked\": boolean|null, \"screen_replaced\": boolean|null, \"damage\": [string]}}\n\
         Damage tags allowed: screen, battery, back, faceid, camera, water, no_power, working.\n\
         Title: {}\nDescription: {}\nJSON:",
        title, description
    );
    let json_str = call_llm(&prompt, image_paths, cfg, 45).await.ok()?;
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
    attrs.extractor = format!("llm:{}", cfg.provider);
    Some(attrs)
}

pub async fn test_llm_prompt(prompt: &str, cfg: &crate::config::LlmConfig) -> Result<String, String> {
    call_llm(prompt, &[], cfg, 90).await
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
