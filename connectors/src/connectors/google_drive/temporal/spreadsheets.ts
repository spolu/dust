import type { ModelId, Result } from "@dust-tt/types";
import { slugify } from "@dust-tt/types";
import { stringify } from "csv-stringify/sync";
import type { sheets_v4 } from "googleapis";
import { google } from "googleapis";
import type { OAuth2Client } from "googleapis-common";

import { dataSourceConfigFromConnector } from "@connectors/lib/api/data_source_config";
import { concurrentExecutor } from "@connectors/lib/async_utils";
import { deleteTable, upsertTableFromCsv } from "@connectors/lib/data_sources";
import type { GoogleDriveFiles } from "@connectors/lib/models/google_drive";
import { GoogleDriveSheet } from "@connectors/lib/models/google_drive";
import { connectorHasAutoPreIngestAllDatabasesFF } from "@connectors/lib/workspace";
import logger from "@connectors/logger/logger";
import { ConnectorResource } from "@connectors/resources/connector_resource";
import type { GoogleDriveObjectType } from "@connectors/types/google_drive";

const MAXIMUM_NUMBER_OF_GSHEET_ROWS = 1000;

type Sheet = sheets_v4.Schema$ValueRange & {
  id: number;
  spreadsheet: {
    id: string;
    title: string;
  };
  title: string;
};

export function isGoogleDriveSpreadSheetFile(
  file: GoogleDriveObjectType | GoogleDriveFiles
) {
  return file.mimeType === "application/vnd.google-apps.spreadsheet";
}

function makeTableIdFromSheetId(spreadsheetId: string, sheetId: number) {
  return `google-spreadsheet-${spreadsheetId}-sheet-${sheetId}`;
}

async function upsertSheetInDb(connector: ConnectorResource, sheet: Sheet) {
  await GoogleDriveSheet.upsert({
    connectorId: connector.id,
    driveFileId: sheet.spreadsheet.id,
    driveSheetId: sheet.id,
    name: sheet.title,
  });
}

async function upsertTable(
  connector: ConnectorResource,
  sheet: Sheet,
  rows: string[][]
) {
  const dataSourceConfig = await dataSourceConfigFromConnector(connector);

  const { id, spreadsheet, title } = sheet;
  // Table name will be slugify in front.
  const tableName = `${spreadsheet.title} - ${title}`;
  const tableDescription = `Structured data from the Google Spreadsheet (${spreadsheet.title}) and sheet (${title}`;

  const csv = stringify(rows);

  await upsertTableFromCsv({
    dataSourceConfig,
    tableId: makeTableIdFromSheetId(spreadsheet.id, id),
    tableName,
    tableDescription,
    tableCsv: csv,
    loggerArgs: {
      connectorId: connector.id,
      sheetId: id,
      spreadsheetId: spreadsheet.id,
    },
  });
}

function getValidRows(allRows: string[][], loggerArgs: object) {
  // We assume that the first row is always the headers.
  // Headers are used to assert the number of cells per row.
  const [headers] = allRows;
  if (!headers || headers.length === 0) {
    return [];
  }

  const validRows: string[][] = allRows.map((row, index) => {
    // We slugify the headers.
    if (index === 0) {
      // TODO(2024-02-16 flav) Move this to another place to slugify all table headers.
      return row.map(slugify);
    }

    // If a row has less cells than headers, we fill the gap with empty strings.
    if (row.length < headers.length) {
      const shortfall = headers.length - row.length;
      return [...row, ...Array(shortfall).fill("")];
    }

    // If a row has more cells than headers we truncate the row.
    if (row.length > headers.length) {
      return row.slice(0, headers.length);
    }

    return row;
  });

  if (validRows.length > MAXIMUM_NUMBER_OF_GSHEET_ROWS) {
    logger.info(
      { ...loggerArgs, rowCount: validRows.length },
      `Found sheet with more than ${MAXIMUM_NUMBER_OF_GSHEET_ROWS}`
    );
  }

  return validRows.slice(0, MAXIMUM_NUMBER_OF_GSHEET_ROWS);
}

async function processSheet(connector: ConnectorResource, sheet: Sheet) {
  if (!sheet.values) {
    return;
  }

  const { id, spreadsheet, title } = sheet;
  const loggerArgs = {
    connectorId: connector.id,
    sheet: {
      id,
      spreadsheet,
      title,
    },
  };

  logger.info(loggerArgs, "Processing sheet in Google Spreadsheet.");

  const rows = await getValidRows(sheet.values, loggerArgs);
  if (rows.length > 0) {
    await upsertTable(connector, sheet, rows);

    await upsertSheetInDb(connector, sheet);
  }
}

async function getAllSheetsFromSpreadSheet(
  sheetsAPI: sheets_v4.Sheets,
  spreadsheet: sheets_v4.Schema$Spreadsheet,
  loggerArgs: object
): Promise<Sheet[]> {
  const { spreadsheetId, properties } = spreadsheet;
  if (!spreadsheetId || !properties) {
    return [];
  }

  const { title: spreadsheetTitle } = properties;

  logger.info(
    {
      ...loggerArgs,
      spreadsheet: {
        id: spreadsheet.spreadsheetId,
      },
      sheetCount: spreadsheet.sheets?.length,
    },
    "List sheets in spreadsheet."
  );

  const sheets: Sheet[] = [];
  for (const sheet of spreadsheet.sheets ?? []) {
    const { properties } = sheet;
    if (!properties) {
      continue;
    }

    const { sheetId, sheetType, title } = properties;
    // We only support "GRID" sheet.
    if (sheetType !== "GRID" || !title || !sheetId) {
      continue;
    }

    const s = await sheetsAPI.spreadsheets.values.get({
      range: title,
      spreadsheetId,
      valueRenderOption: "FORMATTED_VALUE",
    });

    sheets.push({
      ...s.data,
      id: sheetId,
      spreadsheet: {
        id: spreadsheetId,
        title: spreadsheetTitle ?? "Untitled Spreadsheet",
      },
      title,
    });
  }

  return sheets;
}

export async function syncSpreadSheet(
  oauth2client: OAuth2Client,
  connectorId: ModelId,
  file: GoogleDriveObjectType
): Promise<boolean> {
  const connector = await ConnectorResource.fetchById(connectorId);
  if (!connector) {
    throw new Error("Connector not found.");
  }

  const hasFF = await connectorHasAutoPreIngestAllDatabasesFF(connector);
  if (!hasFF) {
    return false;
  }

  const loggerArgs = {
    connectorId,
  };

  logger.info(
    {
      ...loggerArgs,
      spreadsheet: {
        id: file.id,
      },
    },
    "Syncing Google Spreadsheet."
  );

  const sheetsAPI = google.sheets({ version: "v4", auth: oauth2client });
  const spreadsheet = await sheetsAPI.spreadsheets.get({
    spreadsheetId: file.id,
  });
  const sheets = await getAllSheetsFromSpreadSheet(
    sheetsAPI,
    spreadsheet.data,
    loggerArgs
  );

  // List synced sheets.
  const syncedSheets = await GoogleDriveSheet.findAll({
    where: {
      driveFileId: file.id,
    },
  });

  for (const sheet of sheets) {
    await processSheet(connector, sheet);
  }

  // Delete any previously synced sheets that no longer exist in the current spreadsheet.
  const deletedSyncedSheets = syncedSheets.filter(
    (synced) => !sheets.find((s) => s.id === synced.driveSheetId)
  );
  if (deletedSyncedSheets.length > 0) {
    await deleteAllSheets(connector, deletedSyncedSheets, {
      driveFileId: spreadsheet.data.spreadsheetId ?? "",
    });
  }

  return true;
}

async function deleteSheetForSpreadsheet(
  connector: ConnectorResource,
  sheet: GoogleDriveSheet,
  spreadsheetFileId: string
) {
  const dataSourceConfig = dataSourceConfigFromConnector(connector);

  logger.info(
    {
      connectorId: connector.id,
      sheet,
      spreadsheetFileId,
    },
    "Deleting google drive sheet."
  );

  // First remove the upserted table in core.
  await deleteTable({
    dataSourceConfig,
    tableId: makeTableIdFromSheetId(spreadsheetFileId, sheet.driveSheetId),
    loggerArgs: {
      connectorId: connector.id,
      sheetId: sheet.driveSheetId,
      spreadsheetId: spreadsheetFileId,
    },
  });

  // Then delete the row in DB.
  await sheet.destroy();
}

async function deleteAllSheets(
  connector: ConnectorResource,
  sheetsToDelete: GoogleDriveSheet[],
  spreadsheetFile: { driveFileId: string }
) {
  await concurrentExecutor(
    sheetsToDelete,
    async (sheet) =>
      deleteSheetForSpreadsheet(connector, sheet, spreadsheetFile.driveFileId),
    {
      concurrency: 5,
    }
  );
}

export async function deleteSpreadsheet(
  connector: ConnectorResource,
  file: GoogleDriveFiles
) {
  const sheetsInSpreadsheet = await GoogleDriveSheet.findAll({
    where: {
      driveFileId: file.driveFileId,
    },
  });

  logger.info(
    {
      connectorId: connector.id,
      spreadsheet: file,
    },
    "Deleting Google Spreadsheet."
  );

  if (sheetsInSpreadsheet.length > 0) {
    await deleteAllSheets(connector, sheetsInSpreadsheet, file);
  }
}
