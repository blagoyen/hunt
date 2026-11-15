#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DealInput {
    pub buy_price: f64,
    pub repair_cost: f64,
    pub market_price: f64,
    pub target_margin: Option<f64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DealOutput {
    pub profit: f64,
    pub margin: f64,
    pub max_bid: f64,
    pub total_cost: f64,
}

const SHIPPING: f64 = 6.0;
const DEFAULT_MARGIN: f64 = 0.18;

pub fn profit(input: &DealInput) -> DealOutput {
    let target = input.target_margin.unwrap_or(DEFAULT_MARGIN);
    let total_cost = input.buy_price + input.repair_cost + SHIPPING;
    let profit = if input.market_price > 0.0 {
        input.market_price - total_cost
    } else {
        0.0
    };
    let margin = if input.market_price > 0.0 {
        profit / input.market_price
    } else {
        0.0
    };
    let max_bid = (input.market_price * (1.0 - target) - input.repair_cost - SHIPPING).max(0.0);
    DealOutput {
        profit,
        margin,
        max_bid,
        total_cost,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn basic_profit() {
        let d = profit(&DealInput {
            buy_price: 260.0,
            repair_cost: 150.0,
            market_price: 495.0,
            target_margin: None,
        });
        assert!((d.profit - 79.0).abs() < 1e-9);
        assert!(d.max_bid > 0.0);
    }
    #[test]
    fn zero_market() {
        let d = profit(&DealInput {
            buy_price: 100.0,
            repair_cost: 0.0,
            market_price: 0.0,
            target_margin: None,
        });
        assert_eq!(d.profit, 0.0);
    }
}
