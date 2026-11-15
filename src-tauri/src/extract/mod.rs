pub mod heuristics;
pub mod llm;

use crate::config::LlmConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedAttrs {
    pub model: Option<String>,
    pub storage_gb: Option<i64>,
    pub battery_health: Option<i64>,
    pub icloud_locked: Option<bool>,
    pub carrier_locked: Option<bool>,
    pub screen_replaced: Option<bool>,
    pub damage: Vec<String>,
    pub confidence: f64,
    pub extractor: String,
}

pub async fn extract(title: &str, description: &str) -> ExtractedAttrs {
    let cfg = LlmConfig::load();
    if !cfg.provider.is_empty() {
        if let Some(attrs) = llm::extract_with_llm(title, description, &cfg.provider, &cfg.model, &cfg.api_key).await {
            return attrs;
        }
    }
    let mut attrs = heuristics::extract(title, description);
    attrs.extractor = "heuristic".to_string();
    attrs
}
