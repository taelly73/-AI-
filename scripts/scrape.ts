import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { rawMarkdown } from '../src/data';

async function main() {
  console.log("Parsing markdown to find URLs...");
  const lines = rawMarkdown.split('\n');
  const result: any[] = [];
  let currentCategory = '';
  let currentId = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) {
      currentCategory = line.substring(3).split('(')[0].trim();
    } else if (line.startsWith('- **')) {
      const titleMatch = line.match(/\*\*(.*?)\*\*/);
      let date = '';
      const dm = line.match(/\((202[456]\.[^\)]+)\)$/);
      if (dm) {
        date = dm[1];
      } else {
        const fallbackDm = line.match(/\(([\d\.]+)\)/g);
        if (fallbackDm && fallbackDm.length > 0) {
          date = fallbackDm[fallbackDm.length - 1].replace(/[()]/g, '');
        }
      }
      
      if (titleMatch) {
         const title = titleMatch[1];
         let url = '';
         const nextLine = lines[i+1] ? lines[i+1].trim() : '';
         const urlMatch = nextLine.match(/\[.*?\]\((.*?)\)/);
         if (urlMatch) {
           url = urlMatch[1];
         }
         
         result.push({
           id: String(currentId++),
           title,
           date,
           url,
           category: currentCategory,
           content: ''
         });
      }
    }
  }

  console.log(`Found ${result.length} items to process.`);
  let completed = 0;
  
  // Rate limit concurrency
  const BATCH_SIZE = 20;
  for (let i = 0; i < result.length; i += BATCH_SIZE) {
    const batch = result.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (item) => {
      try {
        if (!item.url) return;
        if (item.url.includes('weibo.com')) {
          item.content = ""; // Skip weibo due to login requirement
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const res = await fetch(item.url, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!res.ok) return;
        
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Remove scripts and styles
        $('script, style').remove();
        
        let text = $('.article').text() || $('.article_box').text();
        if (text) {
          // Clean up the text similarly to normal text
          text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
          item.content = text;
        }
      } catch (e) {
        console.log(`Error fetching ${item.url}:`, e.message);
      } finally {
        completed++;
        if (completed % 20 === 0) console.log(`Completed ${completed}/${result.length}`);
      }
    }));
  }

  fs.writeFileSync(path.join(process.cwd(), 'src/full_data.json'), JSON.stringify(result, null, 2));
  console.log("Data successfully saved to src/full_data.json");
}

main().catch(console.error);
