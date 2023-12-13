use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use anyhow::{anyhow, Result};
use axum::{
    extract::{self, Path},
    routing::{get, post},
    Extension, Json, Router,
};
use dust::sqlite_workers::databases_store::DatabasesStore;
use dust::{
    databases::database::DatabaseRow,
    sqlite_workers::{databases_store, sqlite_database::SqliteDatabase},
    utils::{self, error_response, APIResponse},
};
use hyper::{Body, Client, Request, StatusCode};
use serde::Deserialize;
use serde_json::json;
use tokio::{
    signal::unix::{signal, SignalKind},
    sync::Mutex,
};
use tower_http::trace::{self, TraceLayer};
use tracing::Level;

struct WorkerState {
    databases_store: Box<dyn databases_store::DatabasesStore + Sync + Send>,

    registry: Arc<Mutex<HashMap<String, SqliteDatabase>>>,
    is_shutting_down: Arc<AtomicBool>,
}

impl WorkerState {
    fn new(databases_store: Box<dyn databases_store::DatabasesStore + Sync + Send>) -> Self {
        Self {
            databases_store: databases_store,

            // TODO: store an instant of the last access for each DB.
            registry: Arc::new(Mutex::new(HashMap::new())),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
        }
    }

    async fn run_loop(&self) {
        loop {
            if self.is_shutting_down.load(Ordering::SeqCst) {
                break;
            }

            match self.heartbeat().await {
                Ok(_) => (),
                Err(e) => utils::error(&format!("Failed to send heartbeat: {:?}", e)),
            }
            // TODO: check for inactive DBs to kill.
            tokio::time::sleep(std::time::Duration::from_millis(1024)).await;
        }
    }

    async fn await_pending_queries(&self) {
        // TODO: wait for all pending database queries to finish.
        loop {
            // if no pending query...
            break;
            // tokio::time::sleep(std::time::Duration::from_millis(1024)).await;
        }
    }

    async fn heartbeat(&self) -> Result<()> {
        self._core_request("POST").await
    }

    async fn shutdown(&self) -> Result<()> {
        self.is_shutting_down.store(true, Ordering::SeqCst);
        self._core_request("DELETE").await
    }

    async fn _core_request(&self, method: &str) -> Result<()> {
        let hostname = match std::env::var("HOSTNAME") {
            Ok(hostname) => hostname,
            Err(_) => Err(anyhow!("HOSTNAME not set."))?,
        };

        let core_api = match std::env::var("CORE_API") {
            Ok(core_url) => core_url,
            Err(_) => Err(anyhow!("CORE_API not set."))?,
        };

        let req = Request::builder()
            .method(method)
            .uri(format!("{}/sqlite_workers/{}", core_api, hostname))
            .body(Body::empty())?;

        let res = Client::new().request(req).await?;

        match res.status().as_u16() {
            200 => Ok(()),
            s => Err(anyhow!("Failed to send heartbeat to core. Status: {}", s)),
        }
    }
}

/// Index

async fn index() -> &'static str {
    "Welcome to SQLite worker."
}

// Databases

#[derive(Deserialize)]
struct DbQueryBody {
    query: String,
}

async fn db_query(
    Path(db_id): Path<String>,
    Json(payload): Json<DbQueryBody>,
    Extension(state): Extension<Arc<WorkerState>>,
) -> (StatusCode, Json<APIResponse>) {
    let mut registry = state.registry.lock().await;

    let db = match registry.get(&db_id) {
        Some(db) => db,
        None => {
            let db = SqliteDatabase::new(&db_id);
            registry.insert(db_id.clone(), db);
            registry.get(&db_id).unwrap()
        }
    };

    match db.query(payload.query).await {
        Ok(results) => (
            axum::http::StatusCode::OK,
            Json(APIResponse {
                error: None,
                response: Some(json!(results)),
            }),
        ),
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_server_error",
            "Failed to query database",
            Some(e),
        ),
    }
}

#[derive(serde::Deserialize)]
struct DatabasesRowsUpsertPayload {
    rows: Vec<DatabaseRow>,
    truncate: Option<bool>,
}

async fn databases_rows_upsert(
    extract::Path((database_id, table_id)): extract::Path<(String, String)>,
    extract::Json(payload): extract::Json<DatabasesRowsUpsertPayload>,
    Extension(state): Extension<Arc<WorkerState>>,
) -> (StatusCode, Json<APIResponse>) {
    // Kill the running DB if it exists.
    let mut registry = state.registry.lock().await;
    match registry.get(&database_id) {
        Some(_) => {
            // Removing the DB from the registry will kill it, since it's the last reference.
            registry.remove(&database_id);
        }
        None => (),
    }

    let truncate = match payload.truncate {
        Some(v) => v,
        None => false,
    };

    match state
        .databases_store
        .batch_upsert_database_rows(&database_id, &table_id, &payload.rows, truncate)
        .await
    {
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_server_error",
            "Failed to upsert database rows",
            Some(e),
        ),
        Ok(()) => (
            StatusCode::OK,
            Json(APIResponse {
                error: None,
                response: Some(json!({
                    "success": true
                })),
            }),
        ),
    }
}

#[derive(serde::Deserialize)]
struct DatabasesRowsListQuery {
    offset: Option<usize>,
    limit: Option<usize>,
}

async fn databases_rows_list(
    extract::Path((database_id, table_id)): extract::Path<(String, String)>,
    extract::Query(query): extract::Query<DatabasesRowsListQuery>,
    Extension(state): Extension<Arc<WorkerState>>,
) -> (StatusCode, Json<APIResponse>) {
    let limit_offset = match (query.limit, query.offset) {
        (Some(limit), Some(offset)) => Some((limit, offset)),
        _ => None,
    };
    match state
        .databases_store
        .list_database_rows(&database_id, &table_id, limit_offset)
        .await
    {
        Err(e) => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_server_error",
            "Failed to list database rows",
            Some(e),
        ),
        Ok((rows, total)) => (
            StatusCode::OK,
            Json(APIResponse {
                error: None,
                response: Some(json!({
                    "rows": rows,
                    "total": total,
                })),
            }),
        ),
    }
}

fn main() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(32)
        .enable_all()
        .build()
        .unwrap();

    let r = rt.block_on(async {
        tracing_subscriber::fmt()
            .with_target(false)
            .compact()
            .with_ansi(false)
            .init();

        let databases_store: Box<dyn databases_store::DatabasesStore + Sync + Send> =
            match std::env::var("DATABASES_STORE_DATABASE_URI") {
                Ok(db_uri) => {
                    let s = databases_store::PostgresDatabasesStore::new(&db_uri).await?;
                    s.init().await?;
                    Box::new(s)
                }
                Err(_) => Err(anyhow!("DATABASES_STORE_DATABASE_URI not set."))?,
            };

        let state = Arc::new(WorkerState::new(databases_store));

        let app = Router::new()
            .route("/", get(index))
            .route("/databases/:database_id", post(db_query))
            .route(
                "/databases/:database_id/tables/:table_id/rows",
                post(databases_rows_upsert),
            )
            .route(
                "/databases/:database_id/tables/:table_id/rows",
                get(databases_rows_list),
            )
            .layer(
                TraceLayer::new_for_http()
                    .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                    .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
            )
            .layer(extract::Extension(state.clone()));

        // Start the heartbeat loop.
        let state_clone = state.clone();
        tokio::task::spawn(async move {
            state_clone.run_loop().await;
        });

        let (tx1, rx1) = tokio::sync::oneshot::channel::<()>();
        let (tx2, rx2) = tokio::sync::oneshot::channel::<()>();

        let srv = axum::Server::bind(&"[::]:3005".parse().unwrap())
            .serve(app.into_make_service())
            .with_graceful_shutdown(async {
                rx1.await.ok();
            });

        tokio::spawn(async move {
            if let Err(e) = srv.await {
                utils::error(&format!("server error: {}", e));
            }
            utils::info("[GRACEFUL] Server stopped");
            tx2.send(()).ok();
        });

        utils::info(&format!("Current PID: {}", std::process::id()));

        let mut stream = signal(SignalKind::terminate()).unwrap();
        stream.recv().await;

        // Gracefully shut down the server.
        utils::info("[GRACEFUL] SIGTERM received.");

        // Tell core to stop sending requests.
        utils::info("[GRACEFUL] Sending shutdown request to core...");
        match state.shutdown().await {
            Ok(_) => utils::info("[GRACEFUL] Shutdown request sent."),
            Err(e) => utils::error(&format!("Failed to send shutdown request: {:?}", e)),
        }

        utils::info("[GRACEFUL] Shutting down server...");
        tx1.send(()).ok();

        // Wait for the server to shutdown
        utils::info("[GRACEFUL] Awaiting server shutdown...");
        rx2.await.ok();

        // Wait for the SQLite queries to finish.
        utils::info("[GRACEFUL] Awaiting database queries to finish...");
        state.await_pending_queries().await;

        utils::info("[GRACEFUL] Exiting in 1 second...");

        // sleep for 1 second to allow the logger to flush
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;

        Ok::<(), anyhow::Error>(())
    });

    match r {
        Ok(_) => (),
        Err(e) => {
            utils::error(&format!("Error: {:?}", e));
            std::process::exit(1);
        }
    }
}
