var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_jsdom = require("jsdom");
var import_readability = require("@mozilla/readability");
var import_openai = __toESM(require("openai"), 1);
var import_fs = __toESM(require("fs"), 1);
var fullDataPath = import_path.default.join(process.cwd(), "src/full_data.json");
var transitData = [];
try {
  const dataRaw = import_fs.default.readFileSync(fullDataPath, "utf-8");
  transitData = JSON.parse(dataRaw);
} catch (e) {
  console.error("Failed to load transit data for AI:", e);
}
var keywordMap = {
  "\u4E94\u4E00": ["\u4E94\u4E00", "5\u67081\u65E5", "\u8282\u5047\u65E5", "\u5047\u671F"],
  "\u6539\u9053": ["\u6539\u9053", "\u7ED5\u884C", "\u5BFC\u6539", "\u7529\u7AD9", "\u4E34\u65F6\u8C03\u6574", "\u4E34\u65F6\u8FD0\u8425", "\u7EBF\u8DEF\u8C03\u6574", "\u8C03\u6574"],
  "\u505C\u8FD0": ["\u505C\u8FD0", "\u6682\u505C\u8FD0\u8425", "\u505C\u9A76"],
  "\u5929\u575B": ["\u5929\u575B", "\u5929\u575B\u516C\u56ED", "\u5929\u575B\u4E1C\u95E8", "\u5929\u6865", "\u524D\u95E8", "\u5D07\u6587\u95E8"]
};
var intentGroups = {
  "\u4E94\u4E00": ["\u4E94\u4E00", "\u4E94\u4E00\u8282\u65E5", "\u4E94\u4E00\u5047\u671F", "\u4E94\u4E00\u671F\u95F4"],
  "\u6539\u9053": ["\u6539\u9053", "\u7ED5\u884C", "\u5BFC\u6539", "\u7529\u7AD9", "\u4E34\u65F6\u8C03\u6574", "\u91C7\u53D6\u4E34\u65F6\u8C03\u6574\u63AA\u65BD", "\u7EBF\u8DEF\u8C03\u6574", "\u8C03\u6574\u63AA\u65BD"],
  "\u5929\u575B": ["\u5929\u575B", "\u5929\u575B\u516C\u56ED", "\u5929\u575B\u4E1C\u95E8", "\u5929\u575B\u897F\u95E8", "\u5929\u6865", "\u524D\u95E8", "\u5D07\u6587\u95E8"],
  "\u505C\u8FD0": ["\u505C\u8FD0", "\u6682\u505C\u8FD0\u8425", "\u505C\u9A76"]
};
var normalizeText = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
var cleanSearchContent = (content) => {
  return String(content || "").replace(/上一篇：.*$/g, "").replace(/下一篇：.*$/g, "").replace(/关闭$/g, "");
};
var getIntentGroups = (query) => {
  const normalized = normalizeText(query);
  return Object.entries(intentGroups).filter(([key, values]) => normalized.includes(normalizeText(key)) || values.some((value) => normalized.includes(normalizeText(value)))).map(([key, values]) => [key, ...values]);
};
var includesAnyTerm = (text, terms) => {
  const normalizedText = normalizeText(text);
  return terms.some((term) => normalizedText.includes(normalizeText(term)));
};
var extractQueryTerms = (query) => {
  const terms = /* @__PURE__ */ new Set();
  const normalized = String(query || "").replace(/\s+/g, "");
  Object.entries(keywordMap).forEach(([key, values]) => {
    if (normalized.includes(key) || values.some((value) => normalized.includes(value))) {
      terms.add(key);
      values.forEach((value) => terms.add(value));
    }
  });
  normalized.replace(/我想|想去|我要|请问|有没有|哪些|公交|线路|期间|有影响吗|有影响|影响|了吗|吗|呢|的|了|去|到/g, " ").split(/[，。！？、,.!?;；:：\s]+/).map((term) => term.trim()).filter((term) => term.length >= 2).forEach((term) => terms.add(term));
  return Array.from(terms);
};
var scoreTransitItem = (item, query) => {
  const terms = extractQueryTerms(query);
  const title = String(item.title || "");
  const category = String(item.category || "");
  const content = cleanSearchContent(item.content || "");
  const combined = `${title} ${category} ${content}`;
  const groups = getIntentGroups(query);
  if (groups.length > 0 && !groups.every((group) => includesAnyTerm(combined, group))) {
    return 0;
  }
  return terms.reduce((score, term) => {
    if (title.includes(term)) return score + 6;
    if (category.includes(term)) return score + 4;
    if (content.includes(term)) return score + 2;
    return score;
  }, 0);
};
var getRelevantTransitData = (query) => {
  const scored = transitData.map((item) => ({ item, score: scoreTransitItem(item, query) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored.sort((a, b) => {
    const dateA = new Date(String(a.item.date || "").replace(/\./g, "-")).getTime() || 0;
    const dateB = new Date(String(b.item.date || "").replace(/\./g, "-")).getTime() || 0;
    if (Math.abs(b.score - a.score) <= 4 && dateA !== dateB) return dateB - dateA;
    return b.score - a.score || dateB - dateA;
  }).slice(0, 20).map(({ item }) => item) : transitData.slice(0, 20);
};
var getTransitContextString = (items) => {
  return items.map((d) => {
    const content = cleanSearchContent(d.content || "").slice(0, 260);
    return `ID:${d.id} Title:${d.title} Date:${d.date} Category:${d.category} Content:${content}`;
  }).join("\n");
};
var buildLocalAnswer = (query, items) => {
  if (items.length === 0) {
    return `\u6CA1\u6709\u5728\u73B0\u6709\u516C\u544A\u4E2D\u627E\u5230\u548C\u201C${query}\u201D\u76F4\u63A5\u76F8\u5173\u7684\u8BB0\u5F55\u3002\u5EFA\u8BAE\u6362\u6210\u5177\u4F53\u5730\u70B9\u3001\u7EBF\u8DEF\u53F7\u6216\u7AD9\u540D\u518D\u8BD5\u3002`;
  }
  const lines = items.slice(0, 3).map((item) => {
    const content = cleanSearchContent(item.content || "").slice(0, 520);
    return `ID:${item.id} ${item.title}\uFF08${item.date}\uFF0C${item.category}\uFF09
${content}`;
  });
  return [`\u6839\u636E\u73B0\u6709\u516C\u544A\uFF0C\u548C\u201C${query}\u201D\u6700\u76F8\u5173\u7684\u662F\uFF1A`, "", ...lines].join("\n");
};
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const getAiClient = () => {
    const apiKey = process.env.DEEPSEEK_API_KEY || "sk-e0549cc1f8274d9394d779b92c64268c";
    return new import_openai.default({
      baseURL: "https://api.deepseek.com",
      apiKey
    });
  };
  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });
      const relevantData = getRelevantTransitData(query);
      const localAnswer = buildLocalAnswer(query, relevantData);
      if (relevantData.length > 0) {
        return res.json({ text: localAnswer });
      }
      const openai = getAiClient();
      const prompt = `You are a helpful Transit Information AI Assistant (\u667A\u80FD\u516C\u4EA4\u52A9\u7406) for Beijing Public Transport.
The user is asking: "${query}"

Here are the most relevant current transit announcements:
${getTransitContextString(relevantData)}

Answer the user's question directly based only on the announcements above. If announcements are provided, do not say that no relevant notice was found. List concrete affected lines, stops, and dates when available. Answer in Chinese. Keep the response concise.`;
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-v4-flash"
      });
      return res.json({ text: completion.choices[0].message.content || localAnswer });
    } catch (e) {
      console.error("Error in AI Q&A:", e);
      const query = req.body?.query || "";
      return res.json({ text: buildLocalAnswer(query, getRelevantTransitData(query)) });
    }
  });
  app.post("/api/ai/summarize", async (req, res) => {
    try {
      const { content, title } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });
      const openai = getAiClient();
      const prompt = `Please summarize the following Beijing Public Transport announcement. Extract the core information: affected lines, stop changes, and effective dates. Keep it very concise (bullet points). Title: ${title} Content: ${content}. Answer in Chinese.`;
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-v4-flash"
      });
      return res.json({ text: completion.choices[0].message.content });
    } catch (e) {
      console.error("Error in AI Summarization:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });
  app.get("/api/article", async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      console.log(`Fetching URL: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15e3);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      let html = await response.text();
      const doc = new import_jsdom.JSDOM(html, { url });
      const reader = new import_readability.Readability(doc.window.document);
      const article = reader.parse();
      if (!article) {
        return res.status(404).json({ error: "Could not extract article content" });
      }
      return res.json({
        title: article.title,
        content: article.textContent,
        html: article.content,
        // HTML version optionally keeping formatting
        excerpt: article.excerpt
      });
    } catch (e) {
      console.error("Error fetching article:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });
  app.get("/api/bus/realtime", async (req, res) => {
    try {
      const line = req.query.line;
      if (!line) {
        return res.status(400).json({ error: "Bus line name is required" });
      }
      const apiKey = process.env.TRANSIT_API_KEY;
      if (!apiKey) {
        throw new Error("TRANSIT_API_KEY environment variable is required to fetch real-time data.");
      }
      const targetUrl = `https://api.transit.data.gov/v1/realtime?line=${encodeURIComponent(line)}&apiKey=${apiKey}`;
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch transit data from ${targetUrl}` });
      }
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      console.error("Error fetching real-time bus data:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch(console.error);
//# sourceMappingURL=server.cjs.map
