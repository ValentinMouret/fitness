import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

declare global {
  interface Window {
    workoutHostMilestones: readonly string[];
    workoutTool: (params: CallToolRequest["params"]) => Promise<CallToolResult>;
    mountWorkoutHost: (
      html: string,
      result: CallToolResult,
      workoutId: string,
    ) => Promise<void>;
  }
}

window.mountWorkoutHost = async (html, result, workoutId) => {
  const milestones: string[] = [];
  window.workoutHostMilestones = milestones;
  const mark = (milestone: string) => {
    milestones.push(milestone);
  };
  mark("mount-started");
  const frame = document.createElement("iframe");
  frame.title = "Fitness workout app";
  frame.addEventListener("load", () => mark("iframe-loaded"));
  frame.style.cssText = "width:100%;height:844px;border:0;display:block";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  document.body.style.margin = "0";
  document.body.append(frame);
  const target = frame.contentWindow;
  if (!target) throw new Error("Missing workout iframe window");
  const bridge = new AppBridge(
    null,
    { name: "Fitness acceptance host", version: "1.0.0" },
    { serverTools: {}, logging: {} },
    {
      hostContext: {
        theme: "light",
        displayMode: "inline",
        availableDisplayModes: ["inline", "fullscreen"],
        containerDimensions: { width: window.innerWidth, height: 844 },
      },
    },
  );
  bridge.onsizechange = ({ height }) => {
    if (height !== undefined && Number.isFinite(height) && height > 0)
      frame.style.height = `${Math.ceil(height)}px`;
  };
  bridge.onerror = () => mark("bridge-error");
  bridge.oncalltool = async (params) => {
    const tool = [
      "get_workout_widget",
      "update_workout_widget_set",
      "finish_workout_widget",
    ].includes(params.name)
      ? params.name
      : "other";
    mark(`${tool}:requested`);
    try {
      const returned = await window.workoutTool(params);
      mark(`${tool}:${returned.isError ? "error" : "returned"}`);
      return returned;
    } catch (error) {
      mark(`${tool}:failed`);
      throw error;
    }
  };
  bridge.oninitialized = () => {
    mark("initialized");
    void bridge
      .sendToolInput({ arguments: { workoutId } })
      .then(() => {
        mark("tool-input-sent");
        return bridge.sendToolResult(result);
      })
      .then(() => mark("tool-result-sent"))
      .catch(() => mark("tool-delivery-failed"));
  };
  bridge.onrequestdisplaymode = async ({ mode }) => {
    bridge.setHostContext({
      theme: "light",
      displayMode: mode,
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { width: window.innerWidth, height: 844 },
    });
    return { mode };
  };
  await bridge.connect(new PostMessageTransport(target, target));
  mark("transport-connected");
  frame.srcdoc = html;
  mark("document-assigned");
};
