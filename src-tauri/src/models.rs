use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub label: String,
    pub origin: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub id: String,
    pub label: String,
    pub frames: Vec<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonMatrix {
    pub sources: Vec<Source>,
    pub scenes: Vec<Scene>,
    pub warnings: Vec<String>,
}
