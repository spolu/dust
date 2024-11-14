import { BaseAction } from "../../../../front/lib/api/assistant/actions/index";
import { ModelId } from "../../../../shared/model_id";

export type JITListFilesConfigurationType = {
  id: ModelId;
  sId: string;

  type: "jit_list_files_configuration";

  name: string;
  description: string | null;
};

export interface JITListFilesActionType extends BaseAction {
  agentMessageId: ModelId;
  files: string[];
  functionCallId: string | null;
  functionCallName: string | null;
  step: number;
  type: "jit_list_files_action";
}
