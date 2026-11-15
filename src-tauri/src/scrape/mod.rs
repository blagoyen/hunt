pub mod http;
pub mod sources;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapedListing {
    pub source: String,
    pub external_id: String,
    pub url: String,
    pub title: String,
    pub price: Option<f64>,
    pub location: Option<String>,
    pub seller: Option<String>,
    pub description: Option<String>,
    pub image_urls: Vec<String>,
}
