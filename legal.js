// BATTLEFIGHTER 法律文件頁 — 即時從 Supabase 撈取（單一來源：legal_documents 表）。
// ANON key 為公開可讀金鑰（role=anon），資料安全靠 Row Level Security，非機密。
const SUPABASE_URL = "https://tndnjcneukvpzbefisdk.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZG5qY25ldWt2cHpiZWZpc2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzY5NjEsImV4cCI6MjA5NTE1Mjk2MX0.zhP5V0fCIQDb9R-dMuPLxHkOiKvjIJ3iZRaNQszslfw";
const LANGS = [["zh", "中文"], ["ja", "日本語"], ["en", "English"]];

function esc(s){ return s.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function inline(s){ return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }

// 極簡 Markdown：## / ### 標題、- 清單、**粗體**、空行分段。
function md(src){
  const lines = (src || "").split(/\r?\n/);
  let html = "", inUl = false, para = [];
  const flushP = () => { if(para.length){ html += "<p>" + para.map(inline).join("<br>") + "</p>"; para = []; } };
  const flushUl = () => { if(inUl){ html += "</ul>"; inUl = false; } };
  for(const ln of lines){
    if(/^###\s+/.test(ln)){ flushP(); flushUl(); html += "<h3>" + inline(ln.replace(/^###\s+/,"")) + "</h3>"; }
    else if(/^##\s+/.test(ln)){ flushP(); flushUl(); html += "<h2>" + inline(ln.replace(/^##\s+/,"")) + "</h2>"; }
    else if(/^[-*]\s+/.test(ln)){ flushP(); if(!inUl){ html += "<ul>"; inUl = true; } html += "<li>" + inline(ln.replace(/^[-*]\s+/,"")) + "</li>"; }
    else if(ln.trim() === ""){ flushP(); flushUl(); }
    else { flushUl(); para.push(ln); }
  }
  flushP(); flushUl();
  return html;
}

function pickLang(){
  const u = new URLSearchParams(location.search).get("lang");
  if(u && LANGS.some(l => l[0] === u)) return u;
  const saved = localStorage.getItem("legal_lang");
  if(saved && LANGS.some(l => l[0] === saved)) return saved;
  const n = (navigator.language || "zh").toLowerCase();
  if(n.startsWith("ja")) return "ja";
  if(n.startsWith("en")) return "en";
  return "zh";
}

async function fetchDoc(docId, lang){
  const url = `${SUPABASE_URL}/rest/v1/legal_documents?id=eq.${docId}&locale=eq.${lang}&select=title,body,version,effective_at`;
  const r = await fetch(url, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  return r.json();
}

async function load(docId){
  const lang = pickLang();
  localStorage.setItem("legal_lang", lang);
  document.documentElement.lang = lang;

  const ls = document.getElementById("langs");
  if(ls) ls.innerHTML = LANGS.map(([c,n]) =>
    `<a href="?lang=${c}" class="${c===lang?'active':''}">${n}</a>`).join("");

  const el = document.getElementById("content");
  el.innerHTML = '<p class="loading">Loading…</p>';
  try{
    let data = await fetchDoc(docId, lang);
    if(!data.length && lang !== "zh") data = await fetchDoc(docId, "zh"); // 缺該語言則退回中文
    if(!data.length){ el.innerHTML = "<p>Document not found.</p>"; return; }
    const d = data[0];
    document.title = d.title + " — BATTLEFIGHTER";
    const t = document.getElementById("title"); if(t) t.textContent = d.title;
    const m = document.getElementById("meta");
    if(m){
      const dt = new Date(d.effective_at);
      const ds = isNaN(dt.getTime()) ? d.effective_at : dt.toISOString().slice(0,10);
      m.textContent = `v${d.version} · ${ds}`;
    }
    el.innerHTML = md(d.body);
  }catch(e){
    el.innerHTML = "<p>Failed to load. Please try again later.</p>";
  }
}
