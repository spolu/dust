use anyhow::{anyhow, Result};

use crate::{project::Project, stores::store::Store};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use super::table_schema::TableSchema;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    LOCAL,
    REMOTE,
}

impl ToString for DatabaseType {
    fn to_string(&self) -> String {
        match self {
            DatabaseType::LOCAL => String::from("local"),
            DatabaseType::REMOTE => String::from("remote"),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Database {
    created: u64,
    data_source_id: String,
    database_id: String,
    name: String,
    db_type: DatabaseType,
}

impl Database {
    pub fn new(created: u64, data_source_id: &str, database_id: &str, name: &str) -> Self {
        Database {
            created: created,
            data_source_id: data_source_id.to_string(),
            database_id: database_id.to_string(),
            name: name.to_string(),
            db_type: DatabaseType::LOCAL,
        }
    }

    pub async fn get_schema(
        &self,
        project_id: i64,
        store: Box<dyn Store + Sync + Send>,
    ) -> Result<DatabaseSchema> {
        match self.db_type {
            DatabaseType::REMOTE => Err(anyhow!("Remote DB not implemented.")),
            DatabaseType::LOCAL => {
                let project = Project::new_from_id(project_id);
                let (tables, _) = store
                    .list_databases_tables(&project, &self.data_source_id, &self.database_id, None)
                    .await?;
                let (rows, _) = store
                    .list_database_rows(
                        &project,
                        &self.data_source_id,
                        &self.database_id,
                        &None, // get rows from all tables
                        None,
                    )
                    .await?;

                // group rows by table_id
                let mut table_rows: HashMap<String, Vec<DatabaseRow>> = HashMap::new();

                for row in rows {
                    let table_id = row.table_id();
                    if !table_rows.contains_key(table_id) {
                        table_rows.insert(table_id.to_string(), Vec::new());
                    }
                    table_rows.get_mut(table_id).unwrap().push(row);
                }

                let table_by_id = tables
                    .iter()
                    .map(|table| (table.table_id().to_string(), table))
                    .collect::<HashMap<String, &DatabaseTable>>();

                let table_ids_with_rows = table_rows.keys().collect::<Vec<&String>>();

                let schema_tables = table_ids_with_rows
                    .par_iter()
                    .map(|table_id| {
                        let table = *table_by_id.get(*table_id).unwrap();
                        let rows = table_rows.get(*table_id).unwrap();

                        let row_contents =
                            (rows.iter().map(|x| x.content())).collect::<Vec<&Value>>();
                        let table_schema = TableSchema::from_rows(&row_contents)?;
                        Ok(DatabaseSchemaTable::new(table.clone(), table_schema))
                    })
                    .collect::<Result<Vec<DatabaseSchemaTable>>>()?;

                let mut schema = HashMap::new();
                for schema_table in schema_tables {
                    let table_id = schema_table.table().table_id();
                    schema.insert(table_id.to_string(), schema_table);
                }

                // add emptu tables
                for table in tables {
                    let table_id = table.table_id();
                    if !schema.contains_key(table_id) {
                        schema.insert(
                            table_id.to_string(),
                            DatabaseSchemaTable::new(table.clone(), TableSchema::empty()),
                        );
                    }
                }

                Ok(DatabaseSchema(schema))
            }
        }
    }

    // Getters
    pub fn created(&self) -> u64 {
        self.created
    }
    pub fn data_source_id(&self) -> &str {
        &self.data_source_id
    }
    pub fn database_id(&self) -> &str {
        &self.database_id
    }
    pub fn name(&self) -> &str {
        &self.name
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct DatabaseTable {
    created: u64,
    database_id: String,
    table_id: String,
    name: String,
    description: String,
}

impl DatabaseTable {
    pub fn new(
        created: u64,
        database_id: &str,
        table_id: &str,
        name: &str,
        description: &str,
    ) -> Self {
        DatabaseTable {
            created: created,
            database_id: database_id.to_string(),
            table_id: table_id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
        }
    }

    pub fn created(&self) -> u64 {
        self.created
    }
    pub fn database_id(&self) -> &str {
        &self.database_id
    }
    pub fn table_id(&self) -> &str {
        &self.table_id
    }
    pub fn name(&self) -> &str {
        &self.name
    }
    pub fn description(&self) -> &str {
        &self.description
    }
}
#[derive(Debug, Serialize, Clone)]
pub struct DatabaseRow {
    created: u64,
    table_id: String,
    row_id: String,
    content: Value,
}

impl DatabaseRow {
    pub fn new(created: u64, table_id: &str, row_id: &str, content: &Value) -> Self {
        DatabaseRow {
            created: created,
            table_id: table_id.to_string(),
            row_id: row_id.to_string(),
            content: content.clone(),
        }
    }

    pub fn created(&self) -> u64 {
        self.created
    }
    pub fn table_id(&self) -> &str {
        &self.table_id
    }
    pub fn row_id(&self) -> &str {
        &self.row_id
    }
    pub fn content(&self) -> &Value {
        &self.content
    }
}

#[derive(Debug, Serialize)]
struct DatabaseSchemaTable {
    table: DatabaseTable,
    schema: TableSchema,
}

impl DatabaseSchemaTable {
    pub fn new(table: DatabaseTable, schema: TableSchema) -> Self {
        DatabaseSchemaTable { table, schema }
    }

    pub fn table(&self) -> &DatabaseTable {
        &self.table
    }
}

#[derive(Debug, Serialize)]
pub struct DatabaseSchema(HashMap<String, DatabaseSchemaTable>);
