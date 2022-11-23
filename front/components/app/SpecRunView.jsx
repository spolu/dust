import TextareaAutosize from "react-textarea-autosize";
import Input from "./blocks/Input";
import Data from "./blocks/Data";
import LLM from "./blocks/LLM";
import Code from "./blocks/Code";
import Search from "./blocks/Search";
import Curl from "./blocks/Curl";
import Browser from "./blocks/Browser";
import { Map, Reduce } from "./blocks/MapReduce";

export default function SpecRunView({
  user,
  app,
  readOnly,
  spec,
  run,
  runRequested,
  handleSetBlock,
  handleDeleteBlock,
  handleMoveBlockUp,
  handleMoveBlockDown,
}) {
  return (
    <>
      {app.description ? (
        <div className="flex flex-auto mb-4">
          <div className="flex text-sm text-gray-400 italic">
            {app.description}
          </div>
        </div>
      ) : null}

      {/* This is a hack to force loading the component before we render the LLM blocks.
          Otherwise the autoresize does not work on init?
          TODO(spolu): investigate */}
      <TextareaAutosize className="hidden" value="foo" />

      <div className="flex flex-col space-y-2">
        {spec.map((block, idx) => {
          // Match status with block
          let status = null;
          if (
            run &&
            run.status &&
            idx < run.status.blocks.length &&
            run.status.blocks[idx].block_type == block.type &&
            run.status.blocks[idx].name == block.name
          ) {
            status = run.status.blocks[idx];
          }
          switch (block.type) {
            case "input":
              return (
                <Input
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "data":
              return (
                <Data
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "llm":
              return (
                <LLM
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "code":
              return (
                <Code
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "map":
              return (
                <Map
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "reduce":
              return (
                <Reduce
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
            case "search":
              return (
                <Search
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "curl":
              return (
                <Curl
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            case "browser":
              return (
                <Browser
                  key={idx}
                  block={block}
                  user={user}
                  app={app}
                  run={run}
                  status={status}
                  running={runRequested || run?.status.run == "running"}
                  readOnly={readOnly}
                  onBlockUpdate={(block) => handleSetBlock(idx, block)}
                  onBlockDelete={() => handleDeleteBlock(idx)}
                  onBlockUp={() => handleMoveBlockUp(idx)}
                  onBlockDown={() => handleMoveBlockDown(idx)}
                />
              );
              break;

            default:
              return (
                <div key={idx} className="flex flex-row px-4 py-4">
                  Unknown block type: {block.type}
                </div>
              );
              break;
          }
        })}
      </div>
    </>
  );
}
