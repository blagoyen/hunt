use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    #[serde(default)]
    pub provider: String, // "", "ollama", "groq", "gemini", "openai"
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
}
impl Default for LlmConfig {
    fn default() -> Self {
        Self { provider: String::new(), model: String::new(), api_key: String::new(), base_url: String::new() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuntProfile {
    #[serde(default = "default_search_terms")]
    pub search_terms: Vec<String>, // targeted KP queries
    #[serde(default = "default_target_models")]
    pub target_models: Vec<String>, // accepted model keywords
    #[serde(default = "default_min_price")]
    pub min_price: f64,
    #[serde(default = "default_max_price")]
    pub max_price: f64,
    #[serde(default = "default_true")]
    pub only_for_sale: bool,
    #[serde(default = "default_true")]
    pub exclude_icloud_locked: bool,
    #[serde(default = "default_exclude_terms")]
    pub exclude_terms: Vec<String>, // hard-no keywords in title/desc
    #[serde(default = "default_max_results")]
    pub max_results: usize,
}
fn default_true() -> bool { true }
fn default_min_price() -> f64 { 0.0 }
fn default_max_price() -> f64 { 600.0 }
fn default_max_results() -> usize { 20 }
fn default_search_terms() -> Vec<String> {
    vec!["iPhone 11".into(),"iPhone 12".into(),"iPhone 13".into(),"iPhone 14".into(),"iPhone 15".into()]
}
fn default_target_models() -> Vec<String> {
    vec!["iphone 11".into(),"iphone 12".into(),"iphone 13".into(),"iphone 14".into(),"iphone 15".into(),"iphone se".into()]
}
fn default_exclude_terms() -> Vec<String> {
    vec!["za delove".into(),"za dijelove".into(),"maticna".into(),"matična".into(),"neispravna maticna".into(),"zakljucan icloud".into(),"zaključan icloud".into(),"icloud zakljucan".into(),"icloud zaključan".into()]
}
impl Default for HuntProfile {
    fn default() -> Self {
        Self {
            search_terms: default_search_terms(),
            target_models: default_target_models(),
            min_price: default_min_price(),
            max_price: default_max_price(),
            only_for_sale: true,
            exclude_icloud_locked: true,
            exclude_terms: default_exclude_terms(),
            max_results: default_max_results(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub llm: LlmConfig,
    #[serde(default)]
    pub hunt_profile: HuntProfile,
    #[serde(default = "default_imei_lookup_mode")]
    pub imei_lookup_mode: String, // "auto" | "applesn" | "tac"
}
fn default_imei_lookup_mode() -> String { "auto".to_string() }

impl Default for AppConfig {
    fn default() -> Self {
        Self { llm: LlmConfig::default(), hunt_profile: HuntProfile::default(), imei_lookup_mode: default_imei_lookup_mode() }
    }
}

impl AppConfig {
    pub fn path() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("hunt")
            .join("config.toml")
    }

    pub fn load() -> Self {
        let path = Self::path();
        if let Ok(content) = std::fs::read_to_string(&path) {
            // Try new format
            if let Ok(cfg) = toml::from_str::<AppConfig>(&content) {
                // If old flat LlmConfig was saved, llm fields may be at root; detect and migrate
                if !cfg.llm.provider.is_empty() || !cfg.llm.model.is_empty() || !cfg.hunt_profile.search_terms.is_empty() {
                    return cfg;
                }
            }
            // Try old flat LlmConfig format
            if let Ok(old) = toml::from_str::<LlmConfig>(&content) {
                return AppConfig { llm: old, hunt_profile: HuntProfile::default(), imei_lookup_mode: default_imei_lookup_mode() };
            }
            // Try partial parse: maybe llm table exists
            if let Ok(v) = toml::from_str::<toml::Value>(&content) {
                let llm = v.get("llm").and_then(|t| toml::from_str::<LlmConfig>(&toml::to_string(t).unwrap_or_default()).ok()).unwrap_or_default();
                let hunt = v.get("hunt_profile").and_then(|t| toml::from_str::<HuntProfile>(&toml::to_string(t).unwrap_or_default()).ok()).unwrap_or_default();
                let imei_mode = v.get("imei_lookup_mode").and_then(|x| x.as_str()).unwrap_or("auto").to_string();
                return AppConfig { llm, hunt_profile: hunt, imei_lookup_mode: imei_mode };
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let content = toml::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())
    }
}

// Backward-compatible wrappers used by existing call sites (will migrate them)
impl LlmConfig {
    pub fn load() -> Self { AppConfig::load().llm }
    pub fn save(&self) -> Result<(), String> {
        let mut app = AppConfig::load();
        app.llm = self.clone();
        app.save()
    }
}
