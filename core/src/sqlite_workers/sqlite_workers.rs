use anyhow::{anyhow, Result};
use hyper::{Body, Client, Request};
use serde::Deserialize;
use serde_json::json;

use crate::{databases::database::DatabaseRow, utils};

pub const HEARTBEAT_INTERVAL_MS: u64 = 3_000;

pub struct SqliteWorker {
    last_heartbeat: u64,
    pod_name: String,
}

impl SqliteWorker {
    pub fn new(pod_name: String, last_heartbeat: u64) -> Self {
        Self {
            last_heartbeat: last_heartbeat,
            pod_name,
        }
    }

    pub fn is_alive(&self) -> bool {
        let now = utils::now();
        let elapsed = now - self.last_heartbeat;

        elapsed < HEARTBEAT_INTERVAL_MS
    }

    pub async fn upsert_rows(
        &self,
        database_unique_id: &str,
        table_id: &str,
        rows: Vec<DatabaseRow>,
        truncate: bool,
    ) -> Result<()> {
        let url = self.url()?;
        let req = Request::builder()
            .method("POST")
            .uri(format!(
                "{}/databases/{}/tables/{}/rows",
                url, database_unique_id, table_id
            ))
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "rows": rows,
                    "truncate": truncate,
                })
                .to_string(),
            ))?;

        let res = Client::new().request(req).await?;

        match res.status().as_u16() {
            200 => Ok(()),
            s => Err(anyhow!(
                "Failed to send rows to sqlite worker. Status: {}",
                s
            )),
        }
    }

    pub async fn get_rows(
        &self,
        database_unique_id: &str,
        table_id: &str,
        limit_offset: Option<(usize, usize)>,
    ) -> Result<(Vec<DatabaseRow>, usize)> {
        let worker_url = self.url()?;

        let mut uri = format!(
            "{}/databases/{}/tables/{}/rows",
            worker_url, database_unique_id, table_id
        );

        if let Some((limit, offset)) = limit_offset {
            uri = format!("{}?limit={}&offset={}", uri, limit, offset);
        }

        let req = Request::builder()
            .method("GET")
            .uri(uri)
            .header("Content-Type", "application/json")
            .body(Body::from(""))?;

        let res = Client::new().request(req).await?;

        #[derive(Deserialize)]
        struct GetRowsResponse {
            rows: Vec<DatabaseRow>,
            total: usize,
        }
        #[derive(Deserialize)]
        struct GetRowsResponseBody {
            error: Option<String>,
            response: Option<GetRowsResponse>,
        }

        match res.status().as_u16() {
            200 => {
                let body = hyper::body::to_bytes(res.into_body()).await?;
                let res: GetRowsResponseBody = serde_json::from_slice(&body)?;
                let (rows, total) = match res.error {
                    Some(e) => Err(anyhow!("Error retrieving rows: {}", e))?,
                    None => match res.response {
                        Some(r) => (r.rows, r.total),
                        None => Err(anyhow!("No rows found in response"))?,
                    },
                };

                Ok((rows, total))
            }
            s => Err(anyhow!(
                "Failed to retrieve rows from sqlite worker. Status: {}",
                s
            ))?,
        }
    }

    pub fn url(&self) -> Result<String> {
        match std::env::var("IS_LOCAL_DEV") {
            Ok(_) => return Ok("http://localhost:3005".to_string()),
            Err(_) => (),
        }
        let cluster_namespace = match std::env::var("CLUSTER_NAMESPACE") {
            Ok(n) => n,
            Err(_) => Err(anyhow!("CLUSTER_NAMESPACE env var not set"))?,
        };
        let core_sqlite_headless_service_name =
            match std::env::var("CORE_SQLITE_HEADLESS_SERVICE_NAME") {
                Ok(s) => s,
                Err(_) => Err(anyhow!("CORE_SQLITE_HEADLESS_SERVICE_NAME env var not set"))?,
            };

        Ok(format!(
            "http://{}.{}.{}.svc.cluster.local",
            self.pod_name, core_sqlite_headless_service_name, cluster_namespace
        ))
    }
}
