import WebSocket from "ws";

const DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";
const API_KEY = process.env.DASHSCOPE_API_KEY;

function log(message: string, source = "asr") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [${source}] ${message}`);
}

function generateTaskId(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export interface ASRSession {
  taskId: string;
  dashscopeWs: WebSocket | null;
  clientWs: WebSocket;
  isStarted: boolean;
  isFinished: boolean;
}

const sessions = new Map<WebSocket, ASRSession>();

export function handleASRConnection(clientWs: WebSocket) {
  if (!API_KEY) {
    log("DASHSCOPE_API_KEY not configured", "asr");
    clientWs.send(JSON.stringify({ type: "error", message: "API key not configured" }));
    clientWs.close();
    return;
  }

  const taskId = generateTaskId();
  const session: ASRSession = {
    taskId,
    dashscopeWs: null,
    clientWs,
    isStarted: false,
    isFinished: false,
  };
  sessions.set(clientWs, session);

  log(`ASR session created: ${taskId}`, "asr");

  const dashscopeWs = new WebSocket(DASHSCOPE_WS_URL, {
    headers: {
      Authorization: `bearer ${API_KEY}`,
    },
  });

  session.dashscopeWs = dashscopeWs;

  dashscopeWs.on("open", () => {
    log(`Connected to DashScope ASR: ${taskId}`, "asr");
    
    const runTaskMsg = {
      header: {
        action: "run-task",
        task_id: taskId,
        streaming: "duplex",
      },
      payload: {
        task_group: "audio",
        task: "asr",
        function: "recognition",
        model: "paraformer-realtime-v2",
        parameters: {
          format: "pcm",
          sample_rate: 16000,
          language_hints: ["zh", "en"],
          disfluency_removal_enabled: false,
        },
        input: {},
      },
    };

    dashscopeWs.send(JSON.stringify(runTaskMsg));
  });

  dashscopeWs.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      const event = message.header?.event;

      switch (event) {
        case "task-started":
          log(`ASR task started: ${taskId}`, "asr");
          session.isStarted = true;
          clientWs.send(JSON.stringify({ type: "started" }));
          break;

        case "result-generated":
          const sentence = message.payload?.output?.sentence;
          if (sentence) {
            clientWs.send(
              JSON.stringify({
                type: "result",
                text: sentence.text || "",
                isFinal: sentence.sentence_end || false,
              })
            );
          }
          break;

        case "task-finished":
          log(`ASR task finished: ${taskId}`, "asr");
          session.isFinished = true;
          clientWs.send(JSON.stringify({ type: "finished" }));
          break;

        case "task-failed":
          log(`ASR task failed: ${taskId} - ${JSON.stringify(message)}`, "asr");
          clientWs.send(
            JSON.stringify({
              type: "error",
              message: message.payload?.message || "Recognition failed",
            })
          );
          break;
      }
    } catch (error) {
      log(`Error parsing DashScope message: ${error}`, "asr");
    }
  });

  dashscopeWs.on("error", (error) => {
    log(`DashScope WebSocket error: ${error.message}`, "asr");
    clientWs.send(JSON.stringify({ type: "error", message: "Connection error" }));
  });

  dashscopeWs.on("close", () => {
    log(`DashScope connection closed: ${taskId}`, "asr");
    if (!session.isFinished) {
      clientWs.send(JSON.stringify({ type: "finished" }));
    }
  });

  clientWs.on("message", (data: Buffer) => {
    if (!session.isStarted || !session.dashscopeWs) {
      return;
    }

    try {
      const strData = data.toString();
      if (strData.startsWith("{")) {
        const json = JSON.parse(strData);
        if (json.type === "stop") {
          sendFinishTask(session);
        }
      } else {
        session.dashscopeWs.send(data);
      }
    } catch {
      session.dashscopeWs.send(data);
    }
  });

  clientWs.on("close", () => {
    log(`Client disconnected: ${taskId}`, "asr");
    if (session.dashscopeWs && !session.isFinished) {
      sendFinishTask(session);
      setTimeout(() => {
        session.dashscopeWs?.close();
      }, 1000);
    }
    sessions.delete(clientWs);
  });

  clientWs.on("error", (error) => {
    log(`Client WebSocket error: ${error.message}`, "asr");
    sessions.delete(clientWs);
  });
}

function sendFinishTask(session: ASRSession) {
  if (!session.dashscopeWs || session.isFinished) return;

  const finishMsg = {
    header: {
      action: "finish-task",
      task_id: session.taskId,
      streaming: "duplex",
    },
    payload: { input: {} },
  };

  session.dashscopeWs.send(JSON.stringify(finishMsg));
  session.isFinished = true;
}
