import { Modal } from "@dust-tt/sparkle";
import { useEffect, useState } from "react";

import { DataSourceType } from "@app/types/data_source";
import { WorkspaceType } from "@app/types/user";

export default function ManagedDataSourceDocumentModal({
  owner,
  dataSource,
  documentId,
  isOpen,
  setOpen,
}: {
  owner: WorkspaceType;
  dataSource: DataSourceType;
  documentId: string | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (documentId) {
      setDownloading(true);
      fetch(
        `/api/w/${owner.sId}/data_sources/${
          dataSource.name
        }/documents/${encodeURIComponent(documentId)}`
      )
        .then(async (res) => {
          if (res.ok) {
            const document = await res.json();
            const titleTag = document.document.tags.find((tag: string) =>
              tag.startsWith("title:")
            );
            if (titleTag) {
              setTitle(titleTag.split("title:")[1]);
            }
            setDownloading(false);
            setText(document.document.text);
          }
        })
        .catch((e) => console.error(e));
    }
  }, [dataSource.name, documentId, owner.sId]);

  function closeModal() {
    setOpen(false);
  }

  if (!documentId) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      hasChanged={false}
      title={title || documentId}
      type="right-side"
    >
      <div className="w-full">
        <div className="text-left">
          {!downloading && documentId && text?.length ? (
            <>
              <div className="whitespace-break-spaces px-2 py-8">{text}</div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
