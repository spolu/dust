import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { useSWRConfig } from "swr";

import { ActionButton, Button } from "@app/components/Button";
import { checkProvider } from "@app/lib/providers";

export default function SerperSetup({ owner, open, setOpen, config, enabled }) {
  const { mutate } = useSWRConfig();

  const [apiKey, setApiKey] = useState(config ? config.api_key : "");
  const [testSuccessful, setTestSuccessful] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState("");
  const [enableRunning, setEnableRunning] = useState(false);

  useEffect(() => {
    if (config && config.api_key.length > 0 && apiKey.length == 0) {
      setApiKey(config.api_key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const runTest = async () => {
    setTestRunning(true);
    setTestError("");
    let check = await checkProvider(owner, "serper", { api_key: apiKey });

    if (!check.ok) {
      setTestError(check.error);
      setTestSuccessful(false);
      setTestRunning(false);
    } else {
      setTestError("");
      setTestSuccessful(true);
      setTestRunning(false);
    }
  };

  const handleEnable = async () => {
    setEnableRunning(true);
    let res = await fetch(`/api/w/${owner.sId}/providers/serper`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        config: JSON.stringify({
          api_key: apiKey,
        }),
      }),
    });
    await res.json();
    setEnableRunning(false);
    setOpen(false);
    await mutate(`/api/w/${owner.sId}/providers`);
  };

  const handleDisable = async () => {
    let res = await fetch(`/api/w/${owner.sId}/providers/serper`, {
      method: "DELETE",
    });
    await res.json();
    setOpen(false);
    await mutate(`/api/w/${owner.sId}/providers`);
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={() => setOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              leave="ease-in duration-200"
              leaveTo="opacity-0"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6 lg:max-w-lg">
                <div>
                  <div className="mt-3">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Setup Serper Search
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        Serper lets you search Google (and other search
                        engines). To use Serper you must provide your API key.
                        It can be found{" "}
                        <a
                          className="font-bold text-action-600 hover:text-action-500"
                          href="https://serper.dev/api-key"
                          target="_blank"
                        >
                          here
                        </a>
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        We'll never use your API key for anything other than to
                        run your apps.
                      </p>
                    </div>
                    <div className="mt-6">
                      <input
                        type="text"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-action-500 focus:ring-action-500 sm:text-sm"
                        placeholder="Serper API Key"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setTestSuccessful(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-1 px-2 text-sm">
                  {testError.length > 0 ? (
                    <span className="text-red-500">Error: {testError}</span>
                  ) : testSuccessful ? (
                    <span className="text-green-600">
                      Test succeeded! You can enable Serper Search.
                    </span>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </div>
                <div className="mt-5 flex flex-row items-center space-x-2 sm:mt-6">
                  {enabled ? (
                    <div
                      className="flex-initial cursor-pointer text-sm font-bold text-red-500"
                      onClick={() => handleDisable()}
                    >
                      Disable
                    </div>
                  ) : (
                    <></>
                  )}
                  <div className="flex-1"></div>
                  <div className="flex flex-initial">
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                  </div>
                  <div className="flex flex-initial">
                    {testSuccessful ? (
                      <ActionButton
                        onClick={() => handleEnable()}
                        disabled={enableRunning}
                      >
                        {enabled
                          ? enableRunning
                            ? "Updating..."
                            : "Update"
                          : enableRunning
                          ? "Enabling..."
                          : "Enable"}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        disabled={apiKey.length == 0 || testRunning}
                        onClick={() => runTest()}
                      >
                        {testRunning ? "Testing..." : "Test"}
                      </ActionButton>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
