import { Readable } from "stream";
import { describe, expect, vi } from "vitest";

import { DataSourceViewFactory } from "@app/tests/utils/DataSourceViewFactory";
import { FileFactory } from "@app/tests/utils/FileFactory";
import { createPrivateApiMockRequest } from "@app/tests/utils/generic_private_api_tests";
import { GroupSpaceFactory } from "@app/tests/utils/GroupSpaceFactory";
import { SpaceFactory } from "@app/tests/utils/SpaceFactory";
import { itInTransaction } from "@app/tests/utils/utils";

import handler from "./files";

const CORE_FAKE_RESPONSE = {
  response: {
    table: {
      project: { project_id: 47 },
      data_source_id:
        "21ab3a9994350d8bbd3f76e4c5d233696d6793b271f19407d60d7db825a16381",
      data_source_internal_id:
        "7f93516e45f485f18f889040ed13764a418acf422c34f4f0d3e9474ccccb5386",
      created: 1738254966701,
      table_id: "test-table",
      name: "Test Table",
      description: "Test Description",
      timestamp: 1738254966701,
      tags: [],
      title: "Test Title",
      mime_type: "text/csv",
      provider_visibility: null,
      parent_id: null,
      parents: ["test-table"],
      source_url: null,
      schema: null,
      schema_stale_at: null,
      remote_database_table_id: null,
      remote_database_secret_id: null,
    },
  },
};

// Mock environment config
vi.mock("@dust-tt/types", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, any>;
  return {
    ...mod,
    EnvironmentConfig: {
      ...mod.EnvironmentConfig,
      getEnvVariable: vi.fn((key: string) => {
        switch (key) {
          case "DUST_PRIVATE_UPLOADS_BUCKET":
            return "test-private-bucket";
          case "DUST_UPLOAD_BUCKET":
            return "test-public-bucket";
          default:
            return process.env[key];
        }
      }),
    },
  };
});

vi.mock(import("@app/lib/api/config"), (() => ({
  default: {
    getCoreAPIConfig: vi.fn().mockReturnValue({
      url: "http://localhost:9999",
      apiKey: "foo",
    }),
    getClientFacingUrl: vi.fn().mockReturnValue("http://localhost:3000"),
  },
})) as any);

// Create a mock content setter
const mockFileContent = {
  content: "default content", // Default content
  setContent: (newContent: string) => {
    mockFileContent.content = newContent;
  },
};

// Mock file storage with parameterizable content
vi.mock("@app/lib/file_storage", () => ({
  getPrivateUploadBucket: vi.fn(() => ({
    file: () => ({
      createReadStream: () => Readable.from([mockFileContent.content]),
    }),
  })),
  getPublicUploadBucket: vi.fn(() => ({
    file: () => ({
      createReadStream: () => Readable.from([mockFileContent.content]),
    }),
  })),
}));

describe("POST /api/w/[wId]/data_sources/[dsId]/files", () => {
  itInTransaction("returns 404 when file not found", async (t) => {
    const { req, res, workspace } = await createPrivateApiMockRequest({
      method: "POST",
    });
    const space = await SpaceFactory.global(workspace, t);
    const dataSourceView = await DataSourceViewFactory.folder(
      workspace,
      space,
      t
    );

    req.query.dsId = dataSourceView.dataSource.sId;
    req.body = {
      fileId: "non-existent",
    };

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        type: "file_not_found",
        message: "File not found.",
      },
    });
  });

  itInTransaction(
    "successfully upserts file to data source with the right arguments",
    async (t) => {
      const { req, res, workspace, globalGroup, user } =
        await createPrivateApiMockRequest({
          method: "POST",
        });
      const space = await SpaceFactory.global(workspace, t);
      await GroupSpaceFactory.associate(space, globalGroup);

      const dataSourceView = await DataSourceViewFactory.folder(
        workspace,
        space,
        t
      );
      const file = await FileFactory.csv(workspace, user, {
        useCase: "folder_table",
      });

      req.query.dsId = dataSourceView.dataSource.sId;
      req.body = {
        fileId: file.sId,
        upsertArgs: {
          tableId: "test-table",
          name: "Test Table",
          title: "Test Title",
          description: "Test Description",
          tags: ["test"],
          useAppForHeaderDetection: true,
        },
      };

      // Set specific content for this test
      mockFileContent.setContent("foo,bar,baz\n1,2,3\n4,5,6");

      // First fetch is to create the table
      global.fetch = vi.fn().mockImplementation(async (url, init) => {
        const req = JSON.parse(init.body);
        if ((url as string).endsWith("/tables")) {
          expect(req.table_id).toBe("test-table");
          expect(req.name).toBe("Test Table");
          expect(req.description).toBe("Test Description");
          return Promise.resolve(
            new Response(JSON.stringify(CORE_FAKE_RESPONSE), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
          //
        }

        if ((url as string).endsWith("/rows")) {
          expect(req.rows[0].row_id).toBe("0");
          expect(req.rows[0].value.bar).toBe(2);
          expect(req.rows[1].value.foo).toBe(4);
          return Promise.resolve(
            new Response(
              JSON.stringify({
                response: {
                  success: true,
                },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            )
          );
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    }
  );
});
