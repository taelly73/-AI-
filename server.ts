import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import fs from "fs";

// Load data into memory for AI Retrieval
const fullDataPath = path.join(process.cwd(), 'src/full_data.json');
let transitData: any[] = [];
try {
  const dataRaw = fs.readFileSync(fullDataPath, 'utf-8');
  transitData = JSON.parse(dataRaw);
} catch (e) {
  console.error("Failed to load transit data for AI:", e);
}

const keywordMap: Record<string, string[]> = {
  "五一": ["五一", "5月1日", "节假日", "假期"],
  "改道": ["改道", "绕行", "导改", "甩站", "临时调整", "临时运营", "线路调整", "调整"],
  "停运": ["停运", "暂停运营", "停驶"],
  "天坛": ["天坛", "天坛公园", "天坛东门", "天桥", "前门", "崇文门"]
};

const intentGroups: Record<string, string[]> = {
  "五一": ["五一", "五一节日", "五一假期", "五一期间"],
  "改道": ["改道", "绕行", "导改", "甩站", "临时调整", "采取临时调整措施", "线路调整", "调整措施"],
  "天坛": ["天坛", "天坛公园", "天坛东门", "天坛西门", "天桥", "前门", "崇文门"],
  "停运": ["停运", "暂停运营", "停驶"]
};

const normalizeText = (value: string) => String(value || "").toLowerCase().replace(/\s+/g, "");

const cleanSearchContent = (content: string) => {
  return String(content || "")
    .replace(/上一篇：.*$/g, "")
    .replace(/下一篇：.*$/g, "")
    .replace(/关闭$/g, "");
};

const getIntentGroups = (query: string) => {
  const normalized = normalizeText(query);
  return Object.entries(intentGroups)
    .filter(([key, values]) => normalized.includes(normalizeText(key)) || values.some(value => normalized.includes(normalizeText(value))))
    .map(([key, values]) => [key, ...values]);
};

const includesAnyTerm = (text: string, terms: string[]) => {
  const normalizedText = normalizeText(text);
  return terms.some(term => normalizedText.includes(normalizeText(term)));
};

const extractQueryTerms = (query: string) => {
  const terms = new Set<string>();
  const normalized = String(query || "").replace(/\s+/g, "");

  Object.entries(keywordMap).forEach(([key, values]) => {
    if (normalized.includes(key) || values.some(value => normalized.includes(value))) {
      terms.add(key);
      values.forEach(value => terms.add(value));
    }
  });

  normalized
    .replace(/我想|想去|我要|请问|有没有|哪些|公交|线路|期间|有影响吗|有影响|影响|了吗|吗|呢|的|了|去|到/g, " ")
    .split(/[，。！？、,.!?;；:：\s]+/)
    .map(term => term.trim())
    .filter(term => term.length >= 2)
    .forEach(term => terms.add(term));

  return Array.from(terms);
};

const scoreTransitItem = (item: any, query: string) => {
  const terms = extractQueryTerms(query);
  const title = String(item.title || "");
  const category = String(item.category || "");
  const content = cleanSearchContent(item.content || "");
  const combined = `${title} ${category} ${content}`;
  const groups = getIntentGroups(query);

  if (groups.length > 0 && !groups.every(group => includesAnyTerm(combined, group))) {
    return 0;
  }

  return terms.reduce((score, term) => {
    if (title.includes(term)) return score + 6;
    if (category.includes(term)) return score + 4;
    if (content.includes(term)) return score + 2;
    return score;
  }, 0);
};

const getRelevantTransitData = (query: string) => {
  const scored = transitData
    .map(item => ({ item, score: scoreTransitItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0
    ? scored
        .sort((a, b) => {
          const dateA = new Date(String(a.item.date || "").replace(/\./g, "-")).getTime() || 0;
          const dateB = new Date(String(b.item.date || "").replace(/\./g, "-")).getTime() || 0;
          if (Math.abs(b.score - a.score) <= 4 && dateA !== dateB) return dateB - dateA;
          return b.score - a.score || dateB - dateA;
        })
        .slice(0, 20)
        .map(({ item }) => item)
    : transitData.slice(0, 20);
};

// Format the data as context for the AI
const getTransitContextString = (items: any[]) => {
  return items.map(d => {
    const content = cleanSearchContent(d.content || "").slice(0, 260);
    return `ID:${d.id} Title:${d.title} Date:${d.date} Category:${d.category} Content:${content}`;
  }).join("\n");
};

const buildLocalAnswer = (query: string, items: any[]) => {
  if (items.length === 0) {
    return `没有在现有公告中找到和“${query}”直接相关的记录。建议换成具体地点、线路号或站名再试。`;
  }

  const lines = items.slice(0, 3).map(item => {
    const content = cleanSearchContent(item.content || "").slice(0, 520);
    return `ID:${item.id} ${item.title}（${item.date}，${item.category}）\n${content}`;
  });
  return [`根据现有公告，和“${query}”最相关的是：`, "", ...lines].join("\n");
};

type SearchPlan = {
  keywords: string[];
  mustInclude: string[];
  shouldInclude: string[];
  categoryHints: string[];
  dateHints: string[];
  limit: number;
};

const buildFallbackSearchPlan = (query: string): SearchPlan => {
  const normalized = String(query || "").replace(/\s+/g, "");
  const keywords = Array.from(new Set([normalized].filter(Boolean)));
  const mustInclude: string[] = [];
  const shouldInclude: string[] = [];
  const categoryHints: string[] = [];

  if (/五一|五一节|五一假期|五一期间/.test(normalized)) {
    mustInclude.push("五一");
    shouldInclude.push("改道", "绕行", "甩站", "临时调整", "调整");
    categoryHints.push("线路调整", "临时运营");
  }

  if (/改道|绕行|甩站|调整/.test(normalized)) {
    shouldInclude.push("改道", "绕行", "甩站", "临时调整", "调整");
    categoryHints.push("线路调整", "临时运营");
  }

  if (/停运|停驶/.test(normalized)) {
    shouldInclude.push("停运", "停驶", "暂停运营");
    categoryHints.push("临时运营");
  }

  if (/天坛/.test(normalized)) {
    shouldInclude.push("天坛", "天坛公园", "天坛东门", "前门", "崇文门");
  }

  return {
    keywords,
    mustInclude: Array.from(new Set(mustInclude)),
    shouldInclude: Array.from(new Set(shouldInclude)),
    categoryHints: Array.from(new Set(categoryHints)),
    dateHints: [],
    limit: 10
  };
};

const extractJsonFromText = (text: string) => {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const generateSearchPlan = async (query: string): Promise<SearchPlan> => {
  const fallback = buildFallbackSearchPlan(query);
  try {
    const openai = getAiClient();
    const prompt = `You are generating a search plan for a transit announcement search engine.
Return JSON only with these keys:
{
  "keywords": ["..."],
  "mustInclude": ["..."],
  "shouldInclude": ["..."],
  "categoryHints": ["..."],
  "dateHints": ["YYYY.MM or YYYY-MM-DD"],
  "limit": 10
}

Rules:
- Use Chinese terms from the user's question.
- mustInclude should contain the minimum terms required to find the announcement.
- shouldInclude should contain helpful related terms.
- categoryHints should include likely announcement categories when useful.
- Do not include explanations or markdown.

User query: "${query}"`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-v4-flash",
    });

    const rawText = completion.choices[0].message.content || "";
    const parsed = extractJsonFromText(rawText);
    if (!parsed) return fallback;

    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : fallback.keywords,
      mustInclude: Array.isArray(parsed.mustInclude) ? parsed.mustInclude.map(String) : fallback.mustInclude,
      shouldInclude: Array.isArray(parsed.shouldInclude) ? parsed.shouldInclude.map(String) : fallback.shouldInclude,
      categoryHints: Array.isArray(parsed.categoryHints) ? parsed.categoryHints.map(String) : fallback.categoryHints,
      dateHints: Array.isArray(parsed.dateHints) ? parsed.dateHints.map(String) : fallback.dateHints,
      limit: Number(parsed.limit) > 0 ? Number(parsed.limit) : fallback.limit
    };
  } catch (error) {
    console.error("Failed to generate search plan:", error);
    return fallback;
  }
};

const searchTransitData = (plan: SearchPlan) => {
  const terms = Array.from(new Set([
    ...plan.keywords,
    ...plan.mustInclude,
    ...plan.shouldInclude
  ].filter(Boolean)));
  const categoryHints = new Set(plan.categoryHints.filter(Boolean));

  const scored = transitData
    .map(item => {
      const title = cleanSearchContent(String(item.title || ""));
      const content = cleanSearchContent(String(item.content || ""));
      const category = String(item.category || "");
      const combined = `${title} ${content} ${category}`;

      if (plan.mustInclude.length > 0 && !plan.mustInclude.every(term => normalizeText(combined).includes(normalizeText(term)))) {
        return { item, score: 0 };
      }

      if (categoryHints.size > 0 && !Array.from(categoryHints).some(cat => category.includes(cat))) {
        return { item, score: 0 };
      }

      let score = 0;
      for (const term of terms) {
        const normalizedTerm = normalizeText(term);
        if (!normalizedTerm) continue;
        if (normalizeText(title).includes(normalizedTerm)) score += 6;
        if (normalizeText(category).includes(normalizedTerm)) score += 4;
        if (normalizeText(content).includes(normalizedTerm)) score += 2;
      }

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      const dateA = new Date(String(a.item.date || "").replace(/\./g, "-")).getTime() || 0;
      const dateB = new Date(String(b.item.date || "").replace(/\./g, "-")).getTime() || 0;
      if (Math.abs(b.score - a.score) <= 4 && dateA !== dateB) return dateB - dateA;
      return b.score - a.score || dateB - dateA;
    });

  return scored.slice(0, plan.limit).map(({ item }) => item);
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Natural-language search endpoint: AI generates a search plan first, then local search executes it.
  app.post("/api/ai/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });

      const plan = await generateSearchPlan(query);
      const results = searchTransitData(plan);
      const answer = buildLocalAnswer(query, results);

      return res.json({
        plan,
        results,
        text: answer,
      });
    } catch (e: any) {
      console.error("Error in AI search:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Initialize DeepSeek API Client via OpenAI SDK
  const getAiClient = () => {
    const apiKey = process.env.DEEPSEEK_API_KEY || "sk-e0549cc1f8274d9394d779b92c64268c";
    return new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });
  };

  // AI Endpoint for Smart Search / Q&A
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
      
      const prompt = `You are a helpful Transit Information AI Assistant (智能公交助理) for Beijing Public Transport.
The user is asking: "${query}"

Here are the most relevant current transit announcements:
${getTransitContextString(relevantData)}

Answer the user's question directly based only on the announcements above. If announcements are provided, do not say that no relevant notice was found. List concrete affected lines, stops, and dates when available. Answer in Chinese. Keep the response concise.`;

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-v4-flash",
      });
      
      return res.json({ text: completion.choices[0].message.content || localAnswer });
    } catch (e: any) {
      console.error("Error in AI Q&A:", e);
      const query = req.body?.query || "";
      return res.json({ text: buildLocalAnswer(query, getRelevantTransitData(query)) });
    }
  });

  // AI Endpoint for Summarization
  app.post("/api/ai/summarize", async (req, res) => {
    try {
      const { content, title } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });
      
      const openai = getAiClient();
      
      const prompt = `Please summarize the following Beijing Public Transport announcement. Extract the core information: affected lines, stop changes, and effective dates. Keep it very concise (bullet points). Title: ${title} Content: ${content}. Answer in Chinese.`;

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-v4-flash",
      });
      
      return res.json({ text: completion.choices[0].message.content });
    } catch (e: any) {
      console.error("Error in AI Summarization:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Add robust article fetching endpoint
  app.get("/api/article", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Fetching URL: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      
      let html = await response.text();
      
      // Attempt to fix paths / clean up somewhat
      const doc = new JSDOM(html, { url });
      
      // Use readability to extract article text
      const reader = new Readability(doc.window.document);
      const article = reader.parse();
      
      if (!article) {
        return res.status(404).json({ error: "Could not extract article content" });
      }

      return res.json({
        title: article.title,
        content: article.textContent,
        html: article.content, // HTML version optionally keeping formatting
        excerpt: article.excerpt
      });
    } catch (e: any) {
      console.error("Error fetching article:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Real-time bus tracking endpoint
  app.get("/api/bus/realtime", async (req, res) => {
    try {
      const line = req.query.line as string;
      if (!line) {
        return res.status(400).json({ error: "Bus line name is required" });
      }
      
      const apiKey = process.env.TRANSIT_API_KEY;
      if (!apiKey) {
        throw new Error("TRANSIT_API_KEY environment variable is required to fetch real-time data.");
      }
      
      // Mocking the real integration request to a hypothetical transit data API
      const targetUrl = `https://api.transit.data.gov/v1/realtime?line=${encodeURIComponent(line)}&apiKey=${apiKey}`;
      const response = await fetch(targetUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch transit data from ${targetUrl}` });
      }
      
      const data = await response.json();
      return res.json(data);
    } catch (e: any) {
      console.error("Error fetching real-time bus data:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
