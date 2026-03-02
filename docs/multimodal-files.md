# 图片与 PDF 的接受与读取

LangGraph / LangChain 通过 **消息内容块（content blocks）** 接受图片；PDF 在本项目中通过 **工具** 读取文本后进入对话。

---

## 〇、前端 → 后端整体流程（本项目约定）

**三步：** 用户选择/粘贴/拖拽文件 → 转成 ContentBlock（base64）→ 放入 `HumanMessage.content` → `stream.submit` 发给后端。

| 环节 | 说明 |
|------|------|
| **1. 文件入口** | 前端 `use-file-upload`：选择（`<input type="file">`）、拖拽、粘贴；只接受 jpeg/png/gif/webp/pdf。 |
| **2. 可传输格式** | `multimodal-utils.fileToContentBlock(file)`：`FileReader.readAsDataURL` 得 base64，**去掉** `data:xxx;base64,` 前缀，得到**纯 base64**；图片用 `type: "image"`，PDF 用 `type: "file"`。 |
| **3. 发给后端** | `thread` 里拼 `content: [ ...text, ...contentBlocks ]`，通过 `stream.submit({ messages })` 发到配置的 apiUrl。 |

**后端收到的 Human 消息里 content 块形状：**

- **图片**：`{ type: "image", mimeType: "image/png", data: "<纯 base64>", metadata?: { name: "xxx.png" } }`
- **PDF**：`{ type: "file", mimeType: "application/pdf", data: "<纯 base64>", metadata?: { filename: "x.pdf" } }`

后端在 `src/agent.ts` 的 `normalizeContentBlock` 中据此解析：对 `data` 补上 `data:<mimeType>;base64,` 前缀，图片转成 Ollama 的 `image_url`，PDF 转成带该 data URL 的文本供 `read_pdf` 使用。

---

## 一、图片（Image）

### 1.1 标准 API（LangChain Messages）

用户消息可包含**多模态内容**，图片用 `HumanMessage` 的 `content` 数组中的块表示：

- **方式一**：`type: "image_url"`，Ollama 与多数模型支持  
  - `image_url` 可为 **data URL**（base64）或 **HTTP URL**  
- **方式二**：`type: "image"`（部分 SDK 使用），本项目会在传给 Ollama 前规范为 `image_url`。

```typescript
import { HumanMessage } from "@langchain/core/messages";

// 文本 + 图片（data URL）
const msg = new HumanMessage({
  content: [
    { type: "text", text: "这张图里是什么？" },
    {
      type: "image_url",
      image_url: { url: "data:image/png;base64,iVBORw0KGgo..." },
    },
  ],
});

// 或仅图片 URL
const msg2 = new HumanMessage({
  content: [
    { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } },
  ],
});
```

Ollama 要求图片为 **base64**：若使用 HTTP URL，Ollama 需能访问该 URL，或前端/服务先将图片转为 data URL 再传入。

### 1.2 本项目的处理

- **`src/agent.ts`** 中已对消息做规范化：  
  - 将 `type: "image"` 的块转为 Ollama 可识别的 `type: "image_url"`（含 data URL 或 `image_url.url`）。  
- 因此通过 **LangGraph API** 或 **SDK** 发送的 `content` 中只要包含：
  - `{ type: "image_url", image_url: "<data URL 或 http URL>" }`，或  
  - `{ type: "image", image_url: {...} 或 data: "base64..." }` 等变体，  
  都会在传给 Ollama 前被统一成正确格式。

### 1.3 前端 / API 调用示例

请求体中的 `messages` 使用 OpenAI 风格的多模态格式即可，例如：

```json
{
  "input": {
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "描述这张图" },
          {
            "type": "image_url",
            "image_url": { "url": "data:image/jpeg;base64,/9j/4AAQ..." }
          }
        ]
      }
    ]
  }
}
```

---

## 二、PDF

### 2.1 为何用工具而不是“原生 PDF 消息”

- Ollama 等模型通常**不**直接接受 PDF 二进制作为消息内容。  
- 通用做法是：先把 PDF **抽成文本**（或分页摘要），再把文本放进 `HumanMessage` 的 `text` 里。

本项目中通过 **`read_pdf` 工具** 完成“读取 PDF → 得到文本”，再由模型根据该文本回答或总结。

### 2.2 工具：`read_pdf`

- **名称**：`read_pdf`  
- **作用**：根据 URL 或本地路径读取 PDF，提取正文文本并返回给模型。  
- **参数**（二选一）：  
  - `url`：PDF 的 HTTP(S) 地址；或  
  - `path`：服务器上的文件路径（相对项目根或绝对路径）。

模型在需要“读这个 PDF”时会调用该工具；工具返回的字符串会作为工具结果进入对话，供模型继续推理或总结。

### 2.3 使用方式

- **通过对话**：用户说“请读取并总结这个 PDF：https://example.com/doc.pdf”，模型会调用 `read_pdf({ url: "https://..." })`，再根据返回的文本总结。  
- **本地文件**：若 PDF 在服务器上，用户可以说“读取 ./uploads/report.pdf”，模型会调用 `read_pdf({ path: "./uploads/report.pdf" })`（路径需在服务可访问范围内）。

### 2.4 前端上传 PDF：POST /upload-pdf

当前端**直接提交 PDF 文件**时，可调用后端提供的上传接口，由后端落盘后自动交给 agent 用 `read_pdf` 处理。

- **URL**：`POST /upload-pdf`（与 LangGraph 服务同域，如 `http://localhost:2024/upload-pdf`）
- **Content-Type**：`multipart/form-data`
- **表单字段**：
  - `file`：PDF 文件（必填）
  - `message`：用户问题（可选，默认“请总结这份 PDF。”）
- **成功响应**：`{ success: true, message, savedPath, lastMessage }`，其中 `lastMessage` 为模型对 PDF 的回复文本。
- **失败响应**：`{ success: false, error }`，HTTP 状态码 400/500。

**前端示例（JavaScript）：**

```javascript
const form = new FormData();
form.append("file", pdfFile); // File 对象，来自 <input type="file" accept=".pdf" />
form.append("message", "请用三句话总结这份文档的要点");

const res = await fetch("http://localhost:2024/upload-pdf", {
  method: "POST",
  body: form,
});
const data = await res.json();
if (data.success) {
  console.log("模型回复：", data.lastMessage);
} else {
  console.error(data.error);
}
```

上传的 PDF 会保存到项目目录下的 `uploads/` 目录（已加入 `.gitignore`），agent 会收到包含该路径的消息并调用 `read_pdf` 工具后回复。

---

## 三、小结

| 类型 | 接受方式 | 读取/使用方式 |
|------|----------|----------------|
| **图片** | 消息内容块 `type: "image_url"`（或 `"image"`，由 agent 规范化） | 直接随消息传入，Ollama 视觉模型解析；支持 data URL 或 HTTP URL。 |
| **PDF** | 不作为消息原始类型 | 通过 **`read_pdf`** 工具（`url` 或 `path`）提取文本，文本作为工具结果进入对话。 |

图片走 **LangChain/LangGraph 的多模态消息 API**；PDF 走 **工具 API**（本项目的 `read_pdf` 工具）。

---

## 四、参考

- [LangChain Messages（含多模态）](https://docs.langchain.com/oss/javascript/langchain/messages)
- [Multimodal inputs (LangChain JS)](https://js.langchain.com/docs/how_to/multimodal_inputs)
- 本项目：`src/agent.ts`（`normalizeContentBlock`）、`src/tools/read-pdf.ts`（`read_pdf` 工具）

## 五、涉及文件一览（前端 + 后端）

| 文件 | 作用 |
|------|------|
| **前端** `src/lib/multimodal-utils.ts` | `fileToBase64`、`fileToContentBlock`：File → 纯 base64 → image/file 块；**`isBase64ContentBlock`** 仅把带有效 `data` 的块视为可渲染，避免 "No data found for file" |
| **前端** `src/components/thread/MultimodalPreview.tsx` | 渲染 image/file 块时若缺 `data` 则显示占位（如 "Image (no data)"），不拼 data URL，避免报错 |
| **前端** `src/hooks/use-file-upload.tsx` | 选择/拖拽/粘贴得到 File，调 `fileToContentBlock`，维护 contentBlocks |
| **前端** `src/components/thread/index.tsx` | 用 contentBlocks 拼 `newHumanMessage.content`，`stream.submit({ messages })` 发后端 |
| **后端** `src/agent.ts` | `normalizeContentBlock`：解析 image/file 块（含纯 base64），转成 Ollama / read_pdf 所需格式；**缺 data/url 的块转为占位 text**，避免下游/前端遇到空块 |
| **后端** `src/tools/read-pdf.ts` | `read_pdf` 工具：支持 url（含 data URL）、path，用 pdf-parse 抽文本 |

### 关于 "No data found for file" / "Failed to render conversation"

**错误来源**：**LangGraph SDK** 在渲染某条消息时（例如 `LoadExternalComponent` 遇到 `type: "image"` / `type: "file"` 但**缺少 `data`** 的内容块）会抛出 `"No data found for file"`，被上层 ErrorBoundary 捕获后显示为 `"Failed to render conversation"`。

常见原因：历史消息只存引用未带 payload、流式/恢复时未返回 data、或接口为省流量截断 content，导致前端/SDK 拿到的消息里仍有 image/file 块但 `data` 为空或不存在。

**前端必须做的防护**（在数据交给 SDK 渲染之前）：

1. **类型守卫**：`isBase64ContentBlock` 只把「带有效 `data`（string 且 length > 0）」的块视为可渲染；其余不要当 base64 块传给展示组件。
2. **占位渲染**：在 MultimodalPreview 中，对 image 块先检查 `data`，缺则显示占位（如 "Image (no data)"），不拼 data URL。
3. **消息清洗（推荐）**：在拉取 thread 或准备把 `messages` 交给 SDK 渲染前，对每条消息的 `content` 做一次清洗，把「无 data 的 image/file 块」替换成安全 text，这样 **SDK 内部的 LoadExternalComponent 永远不会收到无 data 的 file/image 块**，从源头避免报错。

**前端示例：在传给 SDK 前清洗 messages**

```ts
function hasValidData(block: unknown): boolean {
  if (!block || typeof block !== "object" || !("type" in block)) return true;
  const b = block as Record<string, unknown>;
  if ((b.type !== "image" && b.type !== "file")) return true;
  const data = b.data;
  return typeof data === "string" && data.length > 0;
}

function sanitizeContent(content: unknown): unknown {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content;
  return content.map((block) => {
    if (hasValidData(block)) return block;
    const b = block as Record<string, unknown>;
    if (b.type === "image" || b.type === "file")
      return { type: "text", text: "【文件/图片已过期或未加载】" };
    return block;
  });
}

// 拉取 thread 后、或 stream 更新后，交给 SDK 前：
const safeMessages = messages.map((msg) =>
  "content" in msg && msg.content != null
    ? { ...msg, content: sanitizeContent(msg.content) }
    : msg
);
```

**后端**：在 `normalizeContentBlock` 中，对缺 data/url 的 image 块返回 `{ type: "text", text: "【图片（无数据，已跳过）】" }`，对无 url 的 file 块返回说明文案。后端只处理「发给模型」的消息；**存回 thread / 返回给前端的消息**由 LangGraph 平台序列化，可能不包含完整 data，因此前端必须自己做上述清洗，避免 SDK 渲染时报错。
