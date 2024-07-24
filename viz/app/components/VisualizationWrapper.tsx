"use client";

import { Button, Collapsible, ContentMessage, Spinner } from "@dust-tt/sparkle";
import type {
  VisualizationRPCCommand,
  VisualizationRPCRequest,
} from "@dust-tt/types";
import * as papaparseAll from "papaparse";
import * as reactAll from "react";
import React, { useCallback } from "react";
import { useEffect, useState } from "react";
import { importCode, Runner } from "react-runner";
import {} from "react-runner";
import * as rechartsAll from "recharts";

// We can't import functions from the types package, so we define them here.
function visualizationExtractCodeNonStreaming(code: string) {
  const regex = /<visualization[^>]*>\s*([\s\S]*?)\s*<\/visualization>/;
  let extractedCode: string | null = null;
  const match = code.match(regex);
  if (match && match[1]) {
    extractedCode = match[1];
  }
  if (!extractedCode) {
    return null;
  }
  return extractedCode;
}

export function useVisualizationAPI(actionId: number) {
  const [error, setError] = useState<Error | null>(null);

  const fetchCode = useCallback(async (): Promise<string | null> => {
    const getCode = makeIframeMessagePassingFunction<
      { actionId: number },
      { code?: string }
    >("getCodeToExecute", actionId);
    try {
      const result = await getCode({ actionId });

      const extractedCode = visualizationExtractCodeNonStreaming(
        result.code ?? ""
      );
      if (!extractedCode) {
        setError(new Error("Failed to extract visualization code."));
        return null;
      }

      return extractedCode;
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error
          : new Error("Failed to fetch visualization code.")
      );

      return null;
    }
  }, [actionId]);

  const fetchFile = useCallback(
    async (fileId: string): Promise<File | null> => {
      const getFile = makeIframeMessagePassingFunction<
        { fileId: string },
        { file?: File }
      >("getFile", actionId);
      const res = await getFile({ fileId });

      if (!res.file) {
        setError(new Error("Failed to fetch file."));
        return null;
      }

      return res.file;
    },
    [actionId]
  );

  // This retry function sends a command to the host window requesting a retry of a previous
  // operation, typically if the generated code fails.
  const retry = useCallback(async (): Promise<void> => {
    const sendRetry = makeIframeMessagePassingFunction("retry", actionId);
    // TODO(2024-07-24 flav) Pass the error message to the host window.
    await sendRetry({});
  }, [actionId]);

  return { fetchCode, fetchFile, error, retry };
}

// This function creates a function that sends a command to the host window with templated Input and Output types.
function makeIframeMessagePassingFunction<Params, Answer>(
  methodName: VisualizationRPCCommand,
  actionId: number
) {
  return (params?: Params) => {
    return new Promise<Answer>((resolve, reject) => {
      const messageUniqueId = Math.random().toString();
      const listener = (event: MessageEvent) => {
        if (event.data.messageUniqueId === messageUniqueId) {
          if (event.data.error) {
            reject(event.data.error);
          } else {
            resolve(event.data.result);
          }
          window.removeEventListener("message", listener);
        }
      };
      window.addEventListener("message", listener);
      window.top?.postMessage(
        {
          command: methodName,
          messageUniqueId,
          actionId,
          params,
        } satisfies VisualizationRPCRequest,
        "*"
      );
    });
  };
}

const useFile = (actionId: number, fileId: string) => {
  const [file, setFile] = useState<File | null>(null);

  const { fetchFile } = useVisualizationAPI(actionId); // Adjust the import based on your project structure

  useEffect(() => {
    const fetch = async () => {
      try {
        const fetchedFile = await fetchFile(fileId);
        setFile(fetchedFile);
      } catch (err) {
        setFile(null);
      }
    };

    if (fileId) {
      fetch();
    }
  }, [fileId, fetchFile]);

  return file;
};

// This component renders the generated code.
// It gets the generated code via message passing to the host window.
export function VisualizationWrapper({ actionId }: { actionId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [errored, setErrored] = useState<Error | null>(null);
  const actionIdParsed = parseInt(actionId, 10);

  const { fetchCode, error, retry } = useVisualizationAPI(actionIdParsed);
  const useFileWrapped = (fileId: string) => useFile(actionIdParsed, fileId);

  useEffect(() => {
    const loadCode = async () => {
      try {
        const fetchedCode = await fetchCode();
        if (fetchedCode) {
          setCode(fetchedCode);
        } else {
          setErrored(new Error("No visualization code found"));
        }
      } catch (error) {
        console.error(error);
        setErrored(new Error("Failed to fetch visualization code"));
      }
    };

    loadCode();
  }, [fetchCode]);

  // Sync the Visualization API error with the local state.
  useEffect(() => {
    if (error) {
      setErrored(error);
    }
  }, [error]);

  if (errored) {
    return <VisualizationError error={errored} retry={() => retry()} />;
  }

  if (!code) {
    return <Spinner variant="color" size="xxl" />;
  }

  const generatedCodeScope = {
    recharts: rechartsAll,
    react: reactAll,
    papaparse: papaparseAll,
    "@dust/react-hooks": { useFile: useFileWrapped },
  };

  const scope = {
    import: {
      recharts: rechartsAll,
      react: reactAll,
      // Here we expose the code generated as a module to be imported by the wrapper code below.
      "@dust/generated-code": importCode(code, { import: generatedCodeScope }),
    },
  };

  // This code imports and renders the generated code.
  const wrapperCode = `
    () => {
    import Comp from '@dust/generated-code';

    return (<Comp />);
    }
  `;

  return (
    <Runner
      code={wrapperCode}
      scope={scope}
      onRendered={(error) => {
        if (error) {
          setErrored(error);
        }
      }}
    />
  );
}

// This is the component to render when an error occurs.
function VisualizationError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <>
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <div>
          <ContentMessage title="Error" variant="pink">
            We encountered an error while running the code generated above. You
            can try again by clicking the button below.
            <Collapsible>
              <Collapsible.Button label="Show details" />
              <Collapsible.Panel>
                <div className="s-flex s-h-16 s-w-full s-items-center s-justify-center s-bg-slate-200">
                  Error messsage:
                  {error.message}
                </div>
              </Collapsible.Panel>
            </Collapsible>
          </ContentMessage>
        </div>
        <div>
          <Button label="Retry" onClick={retry} />
        </div>
      </div>
    </>
  );
}

type ErrorBoundaryProps = {
  actionId: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

// This is the error boundary component that wraps the VisualizationWrapper component.
// It needs to be a class component for error handling to work.
export class VisualizationWrapperWithErrorHandling extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.setState({ hasError: true, error });
  }

  render() {
    if (this.state.hasError) {
      let error: Error;
      if (this.state.error instanceof Error) {
        error = this.state.error;
      } else {
        error = new Error("Unknown error.");
      }

      const retry = makeIframeMessagePassingFunction(
        "retry",
        parseInt(this.props.actionId, 10)
      );
      return <VisualizationError error={error} retry={() => retry} />;
    }

    return <VisualizationWrapper actionId={this.props.actionId} />;
  }
}
