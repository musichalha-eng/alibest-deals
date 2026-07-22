import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { requireAdmin, getPasscodeHash } from './src/middleware/auth.ts';
import { db } from './src/db/index.ts';
import { deals as dealsTable } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

dotenv.config();


const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Path to deals file - use process.cwd() for absolute reliability
const DEALS_FILE = path.join(process.cwd(), 'deals.json');

interface Deal {
  id: string;
  url: string;
  title: string;
  category: string;
  priceRange: string;
  rating: number;
  description: string;
  pros: string[];
  cons: string[];
  imageSearchKeyword: string;
  createdAt: string;
  isFavorite?: boolean;
  likes?: number;
  personalNotes?: string;
  customImage?: string;
}

function getInitialDeals(): Deal[] {
  return [];
}

function getDealsFromFile(): Deal[] {
  try {
    if (fs.existsSync(DEALS_FILE)) {
      const fileContent = fs.readFileSync(DEALS_FILE, 'utf-8');
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading deals from file:', e);
  }
  
  // Robust fallback to empty initial deals
  const initial = getInitialDeals();
  saveDealsToFile(initial);
  return initial;
}

function saveDealsToFile(deals: Deal[]) {
  try {
    fs.writeFileSync(DEALS_FILE, JSON.stringify(deals, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing deals to file:', e);
  }
}

async function syncDbToDealsFile() {
  console.log('Using file-based deals.json directly. Sync to DB skipped.');
}

async function seedDatabaseIfEmpty() {
  console.log('Using file-based deals.json directly. Checking and initializing if empty...');
  getDealsFromFile();
}


async function fetchTitleFromUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // 6 second timeout
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) return '';
    const html = await response.text();
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      // Decode HTML entities
      let rawTitle = titleMatch[1].trim();
      rawTitle = rawTitle.replace(/&quot;/g, '"')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&#39;/g, "'")
                         .replace(/\s+/g, ' ');
      return rawTitle;
    }
  } catch (e) {
    console.error('Failed to fetch page title:', e);
  }
  return '';
}

function isTitleGenericOrBlocked(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase();
  return (
    lower.includes('security check') ||
    lower.includes('forbidden') ||
    lower.includes('blocked') ||
    lower.includes('robot check') ||
    lower.includes('captcha') ||
    lower.includes('aliexpress - online shopping') ||
    lower.trim() === 'aliexpress'
  );
}

// Lazy load Gemini with required options
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY parameter is required. Configure this via the Secrets panel.');
    }
    aiClient = new GoogleGenAI({ 
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API routes - MUST be declared before Vite dev server middleware
app.get('/api/deals', async (req, res) => {
  try {
    const deals = getDealsFromFile();
    // Sort by createdAt descending
    const sortedDeals = [...deals].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    res.json(sortedDeals);
  } catch (error) {
    console.error('Failed to get deals:', error);
    res.status(500).json({ error: 'שגיאה בטעינת המלצות מקובץ הנתונים' });
  }
});

// Authentication route for verifying passcode
app.post('/api/auth/verify-passcode', (req, res) => {
  const { passcode } = req.body;
  if (!passcode) {
    return res.status(400).json({ error: 'נא להזין קוד גישה' });
  }

  const expectedCode = process.env.ADMIN_PASSCODE || 'AliBest#SmartSecure8391';
  if (passcode === expectedCode) {
    const expectedHash = getPasscodeHash();
    return res.json({ token: `passcode_verified:${expectedHash}` });
  }

  res.status(401).json({ error: 'קוד גישה שגוי' });
});

app.post('/api/deals', requireAdmin, async (req, res) => {
  const newDeal = req.body;
  if (!newDeal || !newDeal.title || !newDeal.url) {
    return res.status(400).json({ error: 'מידע חסר להוספת הדיל' });
  }

  try {
    const deals = getDealsFromFile();
    const dealId = newDeal.id || Math.random().toString(36).substring(2, 11);
    
    const formattedDeal: Deal = {
      id: dealId,
      url: newDeal.url,
      title: newDeal.title,
      category: newDeal.category,
      priceRange: newDeal.priceRange,
      rating: Number(newDeal.rating) || 4.8,
      description: newDeal.description,
      pros: newDeal.pros || [],
      cons: newDeal.cons || [],
      imageSearchKeyword: newDeal.imageSearchKeyword || 'shopping',
      createdAt: newDeal.createdAt || new Date().toISOString(),
      isFavorite: newDeal.isFavorite || false,
      likes: newDeal.likes || 0,
      personalNotes: newDeal.personalNotes || undefined,
      customImage: newDeal.customImage || undefined,
    };

    deals.push(formattedDeal);
    saveDealsToFile(deals);
    res.status(201).json(formattedDeal);
  } catch (error) {
    console.error('Failed to add deal:', error);
    res.status(500).json({ error: 'שגיאה בשמירת המלצה חדשה בקובץ הנתונים' });
  }
});

app.put('/api/deals/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updatedDeal = req.body;

  try {
    const deals = getDealsFromFile();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'הדיל לא נמצא' });
    }

    const existing = deals[index];
    deals[index] = {
      ...existing,
      url: updatedDeal.url !== undefined ? updatedDeal.url : existing.url,
      title: updatedDeal.title !== undefined ? updatedDeal.title : existing.title,
      category: updatedDeal.category !== undefined ? updatedDeal.category : existing.category,
      priceRange: updatedDeal.priceRange !== undefined ? updatedDeal.priceRange : existing.priceRange,
      rating: updatedDeal.rating !== undefined ? Number(updatedDeal.rating) : existing.rating,
      description: updatedDeal.description !== undefined ? updatedDeal.description : existing.description,
      pros: updatedDeal.pros !== undefined ? updatedDeal.pros : existing.pros,
      cons: updatedDeal.cons !== undefined ? updatedDeal.cons : existing.cons,
      imageSearchKeyword: updatedDeal.imageSearchKeyword !== undefined ? updatedDeal.imageSearchKeyword : existing.imageSearchKeyword,
      isFavorite: updatedDeal.isFavorite !== undefined ? updatedDeal.isFavorite : existing.isFavorite,
      likes: updatedDeal.likes !== undefined ? updatedDeal.likes : existing.likes,
      personalNotes: updatedDeal.personalNotes !== undefined ? updatedDeal.personalNotes : existing.personalNotes,
      customImage: updatedDeal.customImage !== undefined ? updatedDeal.customImage : existing.customImage,
    };

    saveDealsToFile(deals);
    res.json(deals[index]);
  } catch (error) {
    console.error(`Failed to update deal ${id}:`, error);
    res.status(500).json({ error: 'שגיאה בעדכון המלצה בקובץ הנתונים' });
  }
});

app.delete('/api/deals/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deals = getDealsFromFile();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'הדיל לא נמצא' });
    }

    deals.splice(index, 1);
    saveDealsToFile(deals);
    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete deal ${id}:`, error);
    res.status(500).json({ error: 'שגיאה במחיקת המלצה מקובץ הנתונים' });
  }
});

// Public endpoint to like a deal
app.post('/api/deals/:id/like', async (req, res) => {
  const { id } = req.params;
  try {
    const deals = getDealsFromFile();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'הדיל לא נמצא' });
    }

    deals[index].likes = (deals[index].likes || 0) + 1;
    saveDealsToFile(deals);
    res.json(deals[index]);
  } catch (error) {
    console.error(`Failed to like deal ${id}:`, error);
    res.status(500).json({ error: 'שגיאה בעדכון לייק בקובץ הנתונים' });
  }
});



// Helper to clean AliExpress URL and remove tracking parameters
function cleanAliExpressUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('aliexpress.com')) {
      // Remove all query parameters for a clean product link
      parsed.search = '';
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
}

// Helper to extract item ID from AliExpress URL
function extractAliExpressId(url: string): string {
  try {
    const match = url.match(/item\/(\d+)\.html/);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
}

// Helper to extract descriptive keywords/slug from AliExpress URL path
function extractDescriptiveSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1] || '';
    
    // Remove .html if present
    let cleanedSegment = lastSegment.replace(/\.html$/i, '');
    
    // If it's just numbers, there's no slug text
    if (/^\d+$/.test(cleanedSegment)) {
      return '';
    }
    
    // Split by dashes, underscores, etc.
    const parts = cleanedSegment.split(/[-_+]+/);
    // Filter out numbers and common terms like 'item'
    const textParts = parts.filter(p => p && isNaN(Number(p)) && p.toLowerCase() !== 'item' && p.length > 1);
    
    if (textParts.length > 0) {
      return textParts.join(' ');
    }
  } catch (e) {
    console.error('Failed to extract slug from URL:', e);
  }
  return '';
}

// Helper to parse JSON strings from Gemini robustly, ignoring any outer markdown wrappers or leading/trailing commentary
function robustJsonParse(text: string): any {
  let cleaned = text.trim();
  
  // Strip markdown blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt to locate first { and last } to grab the clean JSON block
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (innerError) {
        throw new Error(`Failed to parse extracted JSON block: ${innerError}`);
      }
    }
    throw e;
  }
}

// Helper to fetch an external image URL and convert it to a base64 inline data format for Gemini multimodal processing
async function fetchImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    console.log(`fetchImageAsBase64: Fetching ${imageUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`fetchImageAsBase64: Failed to fetch, status: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const base64Data = buffer.toString('base64');
    return { mimeType, data: base64Data };
  } catch (e: any) {
    console.error('fetchImageAsBase64: Error fetching image URL as base64:', e.message || e);
    return null;
  }
}

// Smart local fallback to translate product slugs to Hebrew when internet scraping is fully blocked and Gemini has quota issues
function translateSlugToHebrew(slug: string): { title: string; category: string; imageKeyword: string } {
  const words = slug.split(/\s+/);
  let category = 'אחר';
  let imageKeyword = 'gadget';
  
  const lowerSlug = slug.toLowerCase();
  
  // Categorization
  if (lowerSlug.includes('phone') || lowerSlug.includes('earphone') || lowerSlug.includes('headphone') || lowerSlug.includes('charger') || lowerSlug.includes('cable') || lowerSlug.includes('smartwatch') || lowerSlug.includes('led') || lowerSlug.includes('usb') || lowerSlug.includes('speaker') || lowerSlug.includes('soundbar') || lowerSlug.includes('mouse') || lowerSlug.includes('keyboard') || lowerSlug.includes('power bank') || lowerSlug.includes('adapter')) {
    category = "אלקטרוניקה וגאדג'טים";
    imageKeyword = lowerSlug.includes('headphone') || lowerSlug.includes('earphone') ? 'headphones' : (lowerSlug.includes('watch') ? 'smartwatch' : (lowerSlug.includes('speaker') ? 'speaker' : 'gadget'));
  } else if (lowerSlug.includes('kitchen') || lowerSlug.includes('coffee') || lowerSlug.includes('cup') || lowerSlug.includes('knife') || lowerSlug.includes('cook') || lowerSlug.includes('home') || lowerSlug.includes('spoon') || lowerSlug.includes('vacuum') || lowerSlug.includes('cleaner') || lowerSlug.includes('mug') || lowerSlug.includes('pan')) {
    category = "בית ומטבח";
    imageKeyword = lowerSlug.includes('coffee') || lowerSlug.includes('mug') ? 'coffee' : 'kitchen';
  } else if (lowerSlug.includes('shirt') || lowerSlug.includes('shoes') || lowerSlug.includes('bag') || lowerSlug.includes('jacket') || lowerSlug.includes('pant') || lowerSlug.includes('dress') || lowerSlug.includes('backpack') || lowerSlug.includes('hat') || lowerSlug.includes('sunglasses')) {
    category = "אופנה ואקססוריז";
    imageKeyword = lowerSlug.includes('bag') || lowerSlug.includes('backpack') ? 'backpack' : 'fashion';
  } else if (lowerSlug.includes('toy') || lowerSlug.includes('game') || lowerSlug.includes('doll') || lowerSlug.includes('baby') || lowerSlug.includes('lego') || lowerSlug.includes('puzzle') || lowerSlug.includes('remote control')) {
    category = "צעצועים וילדים";
    imageKeyword = 'toy';
  } else if (lowerSlug.includes('makeup') || lowerSlug.includes('skin') || lowerSlug.includes('hair') || lowerSlug.includes('beauty') || lowerSlug.includes('shaver') || lowerSlug.includes('massage') || lowerSlug.includes('trimmer')) {
    category = "בריאות, טיפוח ויופי";
    imageKeyword = 'beauty';
  } else if (lowerSlug.includes('sport') || lowerSlug.includes('gym') || lowerSlug.includes('camp') || lowerSlug.includes('tent') || lowerSlug.includes('fish') || lowerSlug.includes('bicycle') || lowerSlug.includes('fitness') || lowerSlug.includes('running')) {
    category = "ספורט, קמפינג ופנאי";
    imageKeyword = 'fitness';
  } else if (lowerSlug.includes('car') || lowerSlug.includes('motor') || lowerSlug.includes('obd') || lowerSlug.includes('dashcam') || lowerSlug.includes('seat cover') || lowerSlug.includes('gps')) {
    category = "רכב ואופנועים";
    imageKeyword = 'car';
  }

  let translatedTerms: string[] = [];
  const brands = ['lenovo', 'anker', 'baseus', 'xiaomi', 'qcy', 'mijia', 'ugreen', 'samsung', 'apple', 'blitzwolf', 'essager', 'toocki'];
  const brandFound = words.find(w => brands.includes(w.toLowerCase()));
  if (brandFound) {
    translatedTerms.push(brandFound.charAt(0).toUpperCase() + brandFound.slice(1).toLowerCase());
  }

  if (lowerSlug.includes('headphone') || lowerSlug.includes('earphone') || lowerSlug.includes('tws') || lowerSlug.includes('earbuds')) {
    translatedTerms.push('אוזניות אלחוטיות');
  } else if (lowerSlug.includes('speaker')) {
    translatedTerms.push('רמקול נייד');
  } else if (lowerSlug.includes('smartwatch')) {
    translatedTerms.push('שעון חכם');
  } else if (lowerSlug.includes('charger')) {
    translatedTerms.push('מטען מהיר ללא כבל');
  } else if (lowerSlug.includes('power bank')) {
    translatedTerms.push('סוללת גיבוי ניידת');
  } else if (lowerSlug.includes('cable')) {
    translatedTerms.push('כבל טעינה מהיר');
  } else if (lowerSlug.includes('holder') || lowerSlug.includes('mount')) {
    translatedTerms.push('מעמד לרכב');
  } else if (lowerSlug.includes('vacuum')) {
    translatedTerms.push('שואב אבק עוצמתי');
  } else if (lowerSlug.includes('coffee')) {
    translatedTerms.push('אביזרים להכנת קפה');
  } else if (lowerSlug.includes('bag') || lowerSlug.includes('backpack')) {
    translatedTerms.push('תיק גב ארגונומי');
  } else if (lowerSlug.includes('led') || lowerSlug.includes('light') || lowerSlug.includes('lamp')) {
    translatedTerms.push('תאורת LED חכמה');
  } else {
    const cleanWords = words.filter(w => w.length > 3 && isNaN(Number(w)) && !brands.includes(w.toLowerCase()) && w.toLowerCase() !== 'item');
    if (cleanWords.length > 0) {
      translatedTerms.push(cleanWords.slice(0, 3).join(' '));
    } else {
      translatedTerms.push('מוצר אטרקטיבי');
    }
  }

  let finalTitle = translatedTerms.join(' ');
  if (!finalTitle.trim()) {
    finalTitle = 'מוצר מ-AliExpress';
  }

  return {
    title: finalTitle,
    category,
    imageKeyword
  };
}

// Helper to follow redirects (handles affiliate links, short URLs)
async function resolveRedirect(url: string): Promise<string> {
  console.log(`Resolving redirects for URL: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds total timeout
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.url && response.url.startsWith('http')) {
      console.log(`Resolved URL using redirect: 'follow' -> ${response.url}`);
      return response.url;
    }
  } catch (e: any) {
    console.error(`Native redirect resolution failed:`, e.message || e);
  }

  // Fallback to manual redirect tracing loop
  let currentUrl = url;
  const maxRedirects = 6;
  for (let i = 0; i < maxRedirects; i++) {
    try {
      if (!currentUrl.startsWith('http')) {
        break;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout per hop
      
      const response = await fetch(currentUrl, {
        method: 'GET', // GET is safer than HEAD since some CDNs block HEAD requests with a 403 or 405
        redirect: 'manual', // manual redirection inspection
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const location = response.headers.get('location') || response.headers.get('Location');
      if (location) {
        const nextUrl = new URL(location, currentUrl).toString();
        console.log(`Hop ${i + 1}: Redirecting ${currentUrl} -> ${nextUrl}`);
        currentUrl = nextUrl;
      } else {
        // No redirect header found, we reached the destination!
        break;
      }
    } catch (e: any) {
      console.error(`Error resolving redirect at hop ${i}:`, e.message || e);
      break;
    }
  }
  
  console.log(`Final resolved URL after manual redirect tracing: ${currentUrl}`);
  return currentUrl;
}

// Helper function to call Gemini with a cascade of fallback models and retry capabilities.
// This ensures we always get a response even if a model is experiencing high demand (503) or quota issues (429).
async function generateContentWithFallbackCascade(ai: any, params: {
  contents: any;
  responseMimeType?: string;
  responseSchema?: any;
  tools?: any[];
}) {
  const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Dispatching request with model ${modelName} (attempt ${attempt}/2)...`);
        
        const configObj: any = {
          responseMimeType: params.responseMimeType,
          responseSchema: params.responseSchema,
        };
        
        // Only include tools if specified and supported by the model (grounding tools might fail on lite/older models)
        if (params.tools && !modelName.includes('lite') && modelName !== 'gemini-flash-latest') {
          configObj.tools = params.tools;
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: configObj
        });

        if (response && response.text) {
          console.log(`[AI] Successfully generated content using model ${modelName}`);
          return response;
        }
      } catch (err: any) {
        lastErr = err;
        const errMsg = err.message || JSON.stringify(err);
        console.log(`[AI Info] Model ${modelName} attempt ${attempt} notice: transient congestion or argument mismatch.`);

        // If it's a structural argument issue, skip to next model immediately.
        if (errMsg.includes('400') || errMsg.includes('not supported') || errMsg.includes('INVALID_ARGUMENT')) {
          break;
        }

        // Wait a short duration before retrying (exponential backoff)
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        }
      }
    }
  }

  throw lastErr || new Error('Fallback cascade finished.');
}

// AI extraction route
app.post('/api/extract', requireAdmin, async (req, res) => {
  const { url, image, imageUrl } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'קישור לא תקין. יש להזין קישור תקין של AliExpress.' });
  }

  // Resolve redirects (handles marketing/shortened links such as a.aliexpress.com / s.click.aliexpress.com)
  const resolvedUrl = await resolveRedirect(url);
  const cleanedUrl = cleanAliExpressUrl(resolvedUrl);
  const itemId = extractAliExpressId(cleanedUrl);
  const urlSlugTitle = extractDescriptiveSlug(cleanedUrl);
  console.log(`Analyzing URL: ${cleanedUrl} (Item ID: ${itemId || 'not found'}, Slug: "${urlSlugTitle || 'none'}")`);

  try {
    // Attempt local fetch of the title first for additional context if possible
    let htmlTitle = '';
    try {
      htmlTitle = await fetchTitleFromUrl(cleanedUrl);
      console.log(`Extracted local HTML title: "${htmlTitle}"`);
      if (isTitleGenericOrBlocked(htmlTitle)) {
        console.log(`Extracted title "${htmlTitle}" is generic or blocked. Clearing it to avoid confusing the model.`);
        htmlTitle = '';
      }
    } catch (e) {
      console.error('Local title fetch failed:', e);
    }

    // Instant fallback if there is no image, no imageUrl, and we have absolutely no semantic info about the product
    if (!image && !imageUrl && !urlSlugTitle && !htmlTitle) {
      console.log('No image, no URL slug, and HTML title is blocked or generic. Returning instant user-friendly fallback...');
      return res.json({
        title: "מוצר מ-AliExpress (זיהוי אוטומטי חסום)",
        category: "אחר",
        priceRange: "₪59",
        rating: 4.7,
        description: "החילוץ האוטומטי נחסם על ידי אליאקפרס. באפשרותך ללחוץ על כפתור העריכה (מצב עריכה) כדי לעדכן את הפרטים והתמונה ידנית!",
        pros: [],
        cons: [],
        imageSearchKeyword: "gadget"
      });
    }

    const dealSchema = {
      type: 'OBJECT',
      properties: {
        title: { 
          type: 'STRING', 
          description: 'שם המוצר בעברית, קצר ושיווקי (עד 8 מילים). כותרת נקייה ללא ז\'רגון טכני מיותר.' 
        },
        category: { 
          type: 'STRING', 
          description: 'קטגוריית המוצר. חייב להיות בדיוק אחד מהבאים: אלקטרוניקה, גאדג\'טים, טיולים ונסיעות, בית ומטבח, אופנה ואקססוריז, צעצועים וילדים, בריאות, טיפוח ויופי, ספורט, קמפינג ופנאי, רכב ואופנועים, אחר.' 
        },
        priceRange: { 
          type: 'STRING', 
          description: 'מחיר המוצר בשקלים, למשל: ₪35 או ₪120 (ערך בודד בלבד, ללא טווח מחירים).' 
        },
        rating: { 
          type: 'NUMBER', 
          description: 'דירוג המוצר בין 4.0 ל-5.0.' 
        },
        description: { 
          type: 'STRING', 
          description: 'תיאור קצר ומזמין בעברית של עד 25 מילים.' 
        },
        imageSearchKeyword: { 
          type: 'STRING', 
          description: 'מילת מפתח אחת או שתיים באנגלית פשוטה המתארת את המוצר לשליפת תמונה מ-Unsplash (למשל: headphones, coffee, watch, bag, car, speaker, toy, kitchen).' 
        }
      },
      required: ['title', 'category', 'priceRange', 'rating', 'description', 'imageSearchKeyword']
    };

    let resultJson: any = null;

    // Optional multimodal image analysis (Screenshot-based or direct Image URL-based)
    if ((image && typeof image === 'string') || (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http'))) {
      try {
        const ai = getGemini();
        let imagePart: any = null;

        if (image && typeof image === 'string') {
          console.log('Detected screenshot image. Attempting multimodal extraction...');
          const match = image.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            imagePart = {
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            };
          } else {
            imagePart = {
              inlineData: {
                mimeType: 'image/jpeg',
                data: image,
              },
            };
          }
        } else if (imageUrl && typeof imageUrl === 'string') {
          console.log(`Detected direct product imageUrl: ${imageUrl}. Fetching for multimodal analysis...`);
          const fetched = await fetchImageAsBase64(imageUrl);
          if (fetched) {
            imagePart = {
              inlineData: {
                mimeType: fetched.mimeType,
                data: fetched.data,
              },
            };
            console.log('Successfully fetched and converted imageUrl to base64 inline data.');
          }
        }

        if (imagePart) {
          const promptWithImage = `אתה עוזר חכם עבור אתר דילים והמלצות מאליאקספרס בשם "AliBest Deals".
מצורף תמונה של מוצר מאליאקספרס (עשויה להיות תצלום מסך או תמונת מוצר ישירה).
תפקידך לנתח את תמונת המוצר, לזהות מהו המוצר שרואים בתמונה, ולקרוא כל טקסט שקיים בה כדי ליצור דיל אטרקטיבי בשפה העברית.

פרטי הקישור והאתר:
- קישור: ${cleanedUrl}
- שם מוצר מחולץ מהקישור (slug): ${urlSlugTitle || 'לא זמין'}
- כותרת מקומית זמנית: ${htmlTitle || 'לא זמינה'}

הנחיות קריטיות לניסוח:
1. זהה את המוצר המדויק בתמונה. אם זו תמונת מוצר (למשל, שעון, שואב אבק, תיק, מטען, תאורה וכדומה), אל תמציא אוזניות! תאר בדיוק את מה שרואים בתמונה!
2. תרגם ונסח מחדש את כותרת המוצר לעברית שיווקית, ברורה ותמציתית (עד 8 מילים). כותרת נקייה ללא ז'רגון טכני מיותר.
3. סווג את המוצר לקטגוריה הנכונה מתוך הרשימה המותרת.
4. אם המחיר המדויק מופיע בתמונה או בקישור, השתמש בו ותרגם לשקלים (₪) כערך בודד בלבד (למשל: "₪39"). אל תיתן טווח מחירים! אם לא מופיע, הערך מחיר הגיוני ומדויק בשקלים חדשים (₪) (למשל: "₪45").
5. הערך דירוג סביר למוצר (בין 4.0 ל-5.0).
6. נסח תיאור מוצר וסיבות להמלצה קצר ומושך בעברית (עד 25 מילים).
7. קבע מילת מפתח אחת או שתיים באנגלית המתארת את סוג המוצר כדי לשלוף תמונה מתאימה מ-Unsplash.`;

          const response = await generateContentWithFallbackCascade(ai, {
            contents: { parts: [imagePart, { text: promptWithImage }] },
            responseMimeType: 'application/json',
            responseSchema: dealSchema
          });

          const aiText = response.text;
          if (aiText) {
            resultJson = robustJsonParse(aiText);
            console.log('Successfully extracted deal from image using Gemini Multimodal Structured Outputs!');
          }
        }
      } catch (imageError: any) {
        console.error('Multimodal image extraction failed, falling back to link extraction:', imageError.message || imageError);
      }
    }

    // Step 1: Try Gemini-3.5-flash with Google Search Grounding
    if (!resultJson) {
      try {
        console.log('Attempting extraction with Google Search Grounding with structured schema...');
        const ai = getGemini();
        const searchHint = itemId 
          ? `Search for 'AliExpress item ${itemId}' or 'AliExpress product ${itemId}' to get the real product name, current specifications, and reviews.`
          : `Search for the URL: '${cleanedUrl}' to find the real product name and specifications.`;

        const promptWithGrounding = `אתה עוזר חכם עבור אתר דילים והמלצות מאליאקספרס בשם "AliBest Deals".
תפקידך לנתח את קישור המוצר, לאתר את פרטי המוצר האמיתיים באמצעות חיפוש גוגל, ולתרגם ולזקק אותם לכדי דיל אטרקטיבי בשפה העברית.

פרטי המוצר והחיפוש:
- קישור נקי: ${cleanedUrl}
- מזהה מוצר: ${itemId || 'לא זוהה'}
- כותרת מקומית זמנית (עלולה להיות חסומה או חלקית): ${htmlTitle || 'לא זמינה'}
- שם מוצר מחולץ מהקישור (slug): ${urlSlugTitle || 'לא זמין'}
- הנחיית חיפוש: ${searchHint}

אנא השתמש בכלי חיפוש גוגל (Google Search Grounding) כדי לחפש את הקישור או את מזהה המוצר. מצא את שם המוצר המקורי, המותג שלו, קטגוריית המוצר, המחיר הממוצע, והתיאור שלו. אל תמציא מוצר אחר! עליך להביא את המידע האמיתי של המוצר שבקישור.

הנחיות לניסוח:
1. אל תמציא אוזניות (headphones) כברירת מחדל אם המידע חסר! השתמש אך ורק במוצר האמיתי העולה מתוך חיפוש גוגל של הקישור או מזהה המוצר.
2. תרגם ונסח מחדש את כותרת המוצר לעברית שיווקית, ברורה ותמציתית (עד 8 מילים). כותרת נקייה ללא ז'רגון טכני מיותר.
3. סווג את המוצר לקטגוריה הנכונה מתוך הרשימה המותרת.
4. מצא את המחיר המדויק או הממוצע מהחיפוש ותרגם אותו לשקלים חדשים (₪) כערך בודד בלבד (למשל: "₪39" או "₪120"). אל תיתן טווח מחירים!
5. הערך דירוג סביר למוצר (בין 4.0 ל-5.0).
6. נסח תיאור מוצר וסיבות להמלצה קצר ומושך בעברית (עד 25 מילים).
7. קבע מילת מפתח אחת או שתיים באנגלית המתארת את סוג המוצר כדי לשלוף תמונה מתאימה מ-Unsplash.`;

        const response = await generateContentWithFallbackCascade(ai, {
          contents: promptWithGrounding,
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: dealSchema
        });

        const aiText = response.text;
        if (aiText) {
          resultJson = robustJsonParse(aiText);
          console.log('Successfully extracted deal with Google Search Grounding & Structured Outputs!');
        }
      } catch (groundingError: any) {
        console.warn('Google Search Grounding failed or threw quota/rate limit error, moving to fallback:', groundingError.message || groundingError);
      }
    }

    // Step 2: Fallback to Gemini-3.5-flash WITHOUT Google Search Grounding if first attempt failed or returned nothing
    if (!resultJson) {
      try {
        console.log('Attempting extraction WITHOUT Google Search Grounding with structured schema...');
        const ai = getGemini();

        const promptWithoutGrounding = `אתה עוזר חכם עבור אתר דילים והמלצות מאליאקספרס בשם "AliBest Deals".
תפקידך לנתח את כותרת דף המוצר, הקישור, והשם המפורט מחולץ הקישור (slug), לתרגם ולזקק אותם לכדי דיל אטרקטיבי בשפה העברית.

פרטי המוצר:
- קישור: ${cleanedUrl}
- שם מוצר מחולץ הקישור (slug/keywords): ${urlSlugTitle || 'לא זמין'}
- כותרת דף המוצר: ${htmlTitle || 'לא זמינה - נא להשתמש בשם מחולץ הקישור (slug) לעיל כדי לתרגם למוצר האמיתי'}

הנחיות לניסוח:
1. אל תמציא אוזניות (headphones) כברירת מחדל אם המידע חסר! נתח את ה-slug או כותרת הדף כדי להבין מהו המוצר באמת. אם ה-slug הוא "oD8G8hV" או ג'יבריש דומה ואין כותרת דף, תאר מוצר מ-AliExpress כללי או השתמש בקטגוריה "אחר", אך אל תניח שזה אוזניות!
2. תרגם ונסח מחדש את כותרת המוצר לעברית שיווקית, ברורה ותמציתית (עד 8 מילים). כותרת נקייה ללא ז'רגון טכני מיותר.
3. סווג את המוצר לקטגוריה הנכונה מתוך הרשימה המותרת.
4. הערך מחיר בודד מדויק או סביר בשקלים חדשים (₪) (למשל: "₪35" או "₪89"). אל תיתן טווח מחירים!
5. הערך דירוג סביר למוצר (בין 4.0 ל-5.0).
6. נסח תיאור מוצר וסיבות להמלצה קצר ומושך בעברית (עד 25 מילים).
7. קבע מילת מפתח אחת או שתיים באנגלית המתארת את סוג המוצר כדי לשלוף תמונה מתאימה מ-Unsplash.`;

        const response = await generateContentWithFallbackCascade(ai, {
          contents: promptWithoutGrounding,
          responseMimeType: 'application/json',
          responseSchema: dealSchema
        });

        const aiText = response.text;
        if (aiText) {
          resultJson = robustJsonParse(aiText);
          console.log('Successfully extracted deal WITHOUT Google Search Grounding & Structured Outputs!');
        }
      } catch (noGroundingError: any) {
        console.warn('Fallback Gemini extraction failed:', noGroundingError.message || noGroundingError);
      }
    }

    // Step 3: Pure local fallback parsing if both Gemini calls failed or timed out (e.g. general quota limits, key missing, network errors)
    if (!resultJson) {
      console.log('Both Gemini extraction attempts failed. Generating high-quality local fallback...');
      
      let cleanTitle = 'מוצר מ-AliExpress';
      let category = 'אחר';
      let imageKeyword = 'gadget';

      // Attempt to extract title from slug first for extremely high quality local fallback!
      if (urlSlugTitle) {
        const slugFallback = translateSlugToHebrew(urlSlugTitle);
        cleanTitle = slugFallback.title;
        category = slugFallback.category;
        imageKeyword = slugFallback.imageKeyword;
      } else if (htmlTitle) {
        // Fallback to simple cleaning of htmlTitle
        let tempTitle = htmlTitle
          .replace(/Buy|Online Shopping|AliExpress|on AliExpress/gi, '')
          .replace(/\|/g, '')
          .trim();
        
        if (tempTitle.length > 50) {
          tempTitle = tempTitle.substring(0, 50) + '...';
        }
        cleanTitle = tempTitle || 'מוצר מ-AliExpress';

        // Infer category / keywords from URL or title text
        const lowerTitle = cleanTitle.toLowerCase();
        
        if (lowerTitle.includes('phone') || lowerTitle.includes('earphone') || lowerTitle.includes('headphone') || lowerTitle.includes('charger') || lowerTitle.includes('cable') || lowerTitle.includes('smartwatch') || lowerTitle.includes('led') || lowerTitle.includes('usb') || lowerTitle.includes('רמקול') || lowerTitle.includes('אוזניות')) {
          category = 'אלקטרוניקה וגאדג\'טים';
          imageKeyword = lowerTitle.includes('headphone') || lowerTitle.includes('earphone') ? 'headphones' : (lowerTitle.includes('watch') ? 'smartwatch' : 'gadget');
        } else if (lowerTitle.includes('kitchen') || lowerTitle.includes('coffee') || lowerTitle.includes('cup') || lowerTitle.includes('knife') || lowerTitle.includes('cook') || lowerTitle.includes('home') || lowerTitle.includes('מטבח') || lowerTitle.includes('ספל')) {
          category = 'בית ומטבח';
          imageKeyword = 'kitchen';
        } else if (lowerTitle.includes('shirt') || lowerTitle.includes('shoes') || lowerTitle.includes('bag') || lowerTitle.includes('jacket') || lowerTitle.includes('pant') || lowerTitle.includes('dress') || lowerTitle.includes('אופנה')) {
          category = 'אופנה ואקססוריז';
          imageKeyword = 'fashion';
        } else if (lowerTitle.includes('toy') || lowerTitle.includes('game') || lowerTitle.includes('doll') || lowerTitle.includes('baby') || lowerTitle.includes('צעצוע')) {
          category = 'צעצועים וילדים';
          imageKeyword = 'toy';
        } else if (lowerTitle.includes('makeup') || lowerTitle.includes('skin') || lowerTitle.includes('hair') || lowerTitle.includes('beauty') || lowerTitle.includes('טיפוח') || lowerTitle.includes('יופי')) {
          category = 'בריאות, טיפוח ויופי';
          imageKeyword = 'beauty';
        } else if (lowerTitle.includes('sport') || lowerTitle.includes('gym') || lowerTitle.includes('camp') || lowerTitle.includes('tent') || lowerTitle.includes('fish') || lowerTitle.includes('ספורט')) {
          category = 'ספורט, קמפינג ופנאי';
          imageKeyword = 'fitness';
        } else if (lowerTitle.includes('car') || lowerTitle.includes('motor') || lowerTitle.includes('obd') || lowerTitle.includes('רכב')) {
          category = 'רכב ואופנועים';
          imageKeyword = 'car';
        }
      }

      resultJson = {
        title: cleanTitle,
        category: category,
        priceRange: '₪49', // Decent default exact price
        rating: 4.7,
        description: 'מוצר מעניין מבית AliExpress. הוסף כעת לרשימה לניהול ומעקב ועדכן פרטים ידנית.',
        pros: [],
        cons: [],
        imageSearchKeyword: imageKeyword
      };
    }

    res.json(resultJson);
  } catch (e: any) {
    console.error('Error in extracting deal:', e);
    res.status(500).json({ error: 'אירעה שגיאה בניתוח הקישור. אנא וודא שהמפתח של Gemini מוגדר ושם המוצר ברור.' });
  }
});

// Configure Vite or production serving
const port = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production serving
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Seed database if empty before starting the server
  await seedDatabaseIfEmpty();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });
}

startServer();
