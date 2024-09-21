use core::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::oauth::store::OAuthStore;
use crate::utils::{self, ParseError};
use anyhow::Result;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialProvider {
    Snowflake,
}

impl fmt::Display for CredentialProvider {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string(&self).unwrap().trim_matches('"')
        )
    }
}

impl FromStr for CredentialProvider {
    type Err = ParseError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match serde_json::from_str(&format!("\"{}\"", s)) {
            Ok(v) => Ok(v),
            Err(_) => Err(ParseError::new()),
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct Credential {
    credential_id: String,
    created: u64,
    provider: CredentialProvider,
    credentials: serde_json::Map<String, serde_json::Value>,
}

impl Credential {
    pub fn new(
        credential_id: String,
        created: u64,
        provider: CredentialProvider,
        credentials: serde_json::Map<String, serde_json::Value>,
    ) -> Self {
        Self {
            credential_id,
            created,
            provider,
            credentials,
        }
    }

    pub fn credential_id_from_row_id_and_secret(row_id: i64, secret: &str) -> Result<String> {
        Ok(format!(
            "{}-{}",
            utils::make_id("cred", row_id as u64)?,
            secret
        ))
    }

    pub fn row_id_and_secret_from_credential_id(credential_id: &str) -> Result<(i64, String)> {
        let parts = credential_id.split('-').collect::<Vec<&str>>();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!(
                "Invalid credential_id format: {}",
                credential_id
            ));
        }
        let (prefix, row_id) = utils::parse_id(parts[0])?;
        let secret = parts[1].to_string();

        if prefix != "cred" {
            return Err(anyhow::anyhow!(
                "Invalid credential_id prefix: {}",
                credential_id
            ));
        }

        Ok((row_id as i64, secret))
    }

    pub async fn create(
        store: Box<dyn OAuthStore + Sync + Send>,
        provider: CredentialProvider,
        credentials: serde_json::Map<String, serde_json::Value>,
    ) -> Result<Self> {
        let c = store.create_credential(provider, credentials).await?;

        Ok(c)
    }

    pub fn credential_id(&self) -> &str {
        &self.credential_id
    }

    pub fn created(&self) -> u64 {
        self.created
    }

    pub fn provider(&self) -> CredentialProvider {
        self.provider
    }

    pub fn credentials(&self) -> &serde_json::Map<String, serde_json::Value> {
        &self.credentials
    }
}
