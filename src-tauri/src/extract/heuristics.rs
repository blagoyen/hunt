use crate::extract::ExtractedAttrs;
use regex::Regex;

pub fn extract(title: &str, description: &str) -> ExtractedAttrs {
    let text = format!("{} {}", title, description).to_lowercase();
    let mut attrs = ExtractedAttrs::default();
    let mut score: f64 = 0.4;

    // Model
    let model_re = Regex::new(r"iphone\s*(se|1[1-6](?:\s*(?:pro\s*max|pro|max|mini|plus)?)?)").unwrap();
    if let Some(caps) = model_re.captures(&text) {
        let m = caps.get(0).unwrap().as_str();
        let mut model = m.to_string();
        // normalize spacing
        model = model.split_whitespace().collect::<Vec<_>>().join(" ");
        // capitalize
        let mut out = String::new();
        for (i, w) in model.split_whitespace().enumerate() {
            if i == 0 {
                out.push_str(&capitalize(w));
            } else {
                out.push(' ');
                out.push_str(&capitalize(w));
            }
        }
        attrs.model = Some(out);
        score += 0.12;
    }

    // Storage
    let storage_re = Regex::new(r"(\d{2,3})\s*gb").unwrap();
    if let Some(caps) = storage_re.captures(&text) {
        if let Ok(n) = caps.get(1).unwrap().as_str().parse::<i64>() {
            attrs.storage_gb = Some(n);
            score += 0.1;
        }
    }

    // Battery health
    let bat_res = [
        Regex::new(r"baterij[ae]\s*(?:na\s*)?(\d{2,3})\s*%?").unwrap(),
        Regex::new(r"(\d{2,3})\s*%\s*baterij").unwrap(),
        Regex::new(r"baterij[ae]\s*(\d{2,3})").unwrap(),
    ];
    for re in &bat_res {
        if let Some(caps) = re.captures(&text) {
            if let Ok(n) = caps.get(1).unwrap().as_str().parse::<i64>() {
                if (50..=100).contains(&n) {
                    attrs.battery_health = Some(n);
                    score += 0.1;
                    break;
                }
            }
        }
    }

    // iCloud
    if text.contains("icloud") {
        if text.contains("zaklju") || text.contains("locked") || text.contains("zakljucan") {
            attrs.icloud_locked = Some(true);
            score += 0.08;
        } else if text.contains("slobodan") || text.contains("free") || text.contains("otkljucan") {
            attrs.icloud_locked = Some(false);
            score += 0.08;
        }
    }

    // Carrier lock
    if text.contains("sim zaklju") || text.contains("carrier lock") || text.contains("sim lock") || text.contains("zakljucan za sim") {
        attrs.carrier_locked = Some(true);
        score += 0.06;
    } else if text.contains("otkljucan") || text.contains("unlocked") {
        attrs.carrier_locked = Some(false);
        score += 0.04;
    }

    // Screen replaced
    if text.contains("menjan ekran") || text.contains("zamenjen ekran") || text.contains("menjao ekran") || text.contains("novi ekran") {
        attrs.screen_replaced = Some(true);
        score += 0.06;
    }

    // Damage keywords
    let damage_map = [
        ("ekran", "screen"),
        ("pukao", "screen"),
        ("pukla", "screen"),
        ("polomljen", "screen"),
        ("baterija", "battery"),
        ("ne puni", "battery"),
        ("zadnje staklo", "back"),
        ("zadnje st.", "back"),
        ("face id", "faceid"),
        ("faceid", "faceid"),
        ("kamera", "camera"),
        ("voda", "water"),
        ("potopljen", "water"),
        ("ne pali", "no_power"),
        ("ne radi", "no_power"),
        ("nema zvuk", "no_power"),
    ];
    let mut damages: Vec<String> = Vec::new();
    for (kw, tag) in damage_map {
        if text.contains(kw) && !damages.contains(&tag.to_string()) {
            damages.push(tag.to_string());
        }
    }
    // If "ispravan"/"kao nov"/"working" present and no damage, mark working
    if (text.contains("ispravan") || text.contains("kao nov") || text.contains("radi savr") || text.contains("working")) && damages.is_empty() {
        damages.push("working".to_string());
    }
    attrs.damage = damages;
    if !attrs.damage.is_empty() {
        score += 0.1;
    }

    attrs.confidence = score.min(0.95);
    attrs
}

fn capitalize(w: &str) -> String {
    let mut c = w.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}
