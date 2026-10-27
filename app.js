const $ = id => document.getElementById(id);
const SIZES = {portrait: [1080, 1350], square: [1080, 1080], story: [1080, 1920]};
const styleIds = ["size", "bg_type", "bg_color", "bg_color2", "gradient_angle", "overlay", "text_color",
  "accent_color", "font", "title_size", "body_size", "align", "layout", "handle", "show_numbers", "show_swipe", "show_dots"];

let slides = [{title: "Your hook goes here", body: "Click AI Generate or type your own slides."}];
let sel = 0, bgImage = null;

/* ---------- slide rendering (same DOM is used for preview and export) ---------- */
function theme() {
  const t = {};
  for (const id of styleIds) {
    const e = $(id);
    t[id] = e.type === "checkbox" ? e.checked : (e.type === "number" || e.type === "range") ? Number(e.value) : e.value;
  }
  t.bg_image = bgImage;
  return t;
}

function loadFont(name) {
  const clean = name.replace(/[^A-Za-z0-9 ]/g, "") || "Poppins";
  const id = "gf-" + clean.replace(/ /g, "-");
  if (!document.getElementById(id)) {
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${clean.replace(/ /g, "+")}:wght@400;600;800&display=swap`;
    document.head.appendChild(l);
  }
  return Promise.race([
    Promise.all(["400", "600", "800"].map(w => document.fonts.load(`${w} 40px "${clean}"`))),
    new Promise(r => setTimeout(r, 4000)),
  ]).then(() => clean);
}

// html-to-image can't always read cross-origin Google Fonts CSS, so inline the font files ourselves.
const fontCssCache = {};
async function fontEmbedCss(font) {
  if (fontCssCache[font] !== undefined) return fontCssCache[font];
  let out = "";
  try {
    const href = document.getElementById("gf-" + font.replace(/ /g, "-")).href;
    let css = await (await fetch(href)).text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
    for (const u of urls) {
      const blob = await (await fetch(u)).blob();
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      css = css.split(u).join(data);
    }
    out = css;
  } catch (e) { console.warn("font embed failed", e); }
  return (fontCssCache[font] = out);
}

function el(tag, css, text) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

function buildSlide(slide, t, idx, total, font) {
  const [w, h] = SIZES[t.size] || SIZES.portrait;
  const img = slide.bg_image || (t.bg_type === "image" ? t.bg_image : null);
  let bg;
  if (img) bg = `linear-gradient(rgba(0,0,0,${t.overlay}),rgba(0,0,0,${t.overlay})), url("${img}") center/cover no-repeat`;
  else if (t.bg_type === "solid") bg = t.bg_color;
  else bg = `linear-gradient(${t.gradient_angle}deg,${t.bg_color},${t.bg_color2})`;

  const center = t.align === "center";
  const root = el("div",
    `width:${w}px;height:${h}px;overflow:hidden;background:${bg};color:${t.text_color};` +
    `font-family:'${font}',sans-serif;display:flex;flex-direction:column;justify-content:space-between;` +
    `padding:90px 80px;text-align:${t.align};box-sizing:border-box;`);

  const main = el("div",
    `flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:40px;` +
    `align-items:${center ? "center" : "flex-start"};overflow:hidden;`);
  if (t.layout === "quote") main.appendChild(el("div", `font-size:240px;line-height:.6;color:${t.accent_color};font-weight:800`, "“"));
  main.appendChild(el("div", `width:120px;height:10px;border-radius:5px;background:${t.accent_color};flex:none`));
  if (slide.title) {
    const ts = t.title_size * (t.layout === "bold" ? 1.15 : 1);
    main.appendChild(el("div", `font-size:${ts}px;font-weight:800;line-height:1.12;color:${t.accent_color};white-space:pre-wrap;flex:none`, slide.title)).className = "fit";
  }
  if (slide.body) {
    const b = el("div",
      `font-size:${t.body_size}px;font-weight:${t.layout === "quote" ? 600 : 400};line-height:1.4;white-space:pre-wrap;flex:none;` +
      (t.layout === "quote" ? "font-style:italic;" : ""), slide.body);
    b.className = "fit";
    main.appendChild(b);
  }
  root.appendChild(main);
  if (slide.sticker && slide.stickerPos !== "none") {
    const px = {s: 140, m: 220, l: 340}[slide.stickerSize || "m"];
    const P = {tr: "top:40px;right:50px", tl: "top:40px;left:50px", br: "bottom:130px;right:50px", bl: "bottom:130px;left:50px",
      c: "top:50%;left:50%;transform:translate(-50%,-50%)"}[slide.stickerPos || "tr"];
    root.style.position = "relative";
    root.appendChild(el("div", `position:absolute;${P};font-size:${px}px;line-height:1;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;z-index:2`, slide.sticker));
  }
  if (t.show_dots && total > 1) {
    const dots = el("div", `display:flex;justify-content:center;align-items:center;gap:14px;flex:none;margin-top:30px`);
    for (let k = 0; k < total; k++)
      dots.appendChild(el("div", k === idx
        ? `width:56px;height:16px;border-radius:8px;background:${t.accent_color}`
        : `width:16px;height:16px;border-radius:50%;background:${t.text_color};opacity:.35`));
    root.appendChild(dots);
  }

  const foot = el("div", "display:flex;justify-content:space-between;align-items:center;font-size:30px;opacity:.85;min-height:40px");
  const cell = (txt, a, bold) => el("div", `flex:1;text-align:${a};${bold ? "font-weight:600;" : ""}`, txt);
  foot.append(
    cell(t.show_numbers ? `${idx + 1}/${total}` : "", "left"),
    cell(t.handle, "center", true),
    cell(t.show_swipe && idx < total - 1 ? "swipe →" : "", "right"));
  root.appendChild(foot);
  return {root, main};
}

// Shrink text until it fits so long content never overflows. Must run while attached to the DOM.
function fit(main) {
  let n = 0;
  while (main.scrollHeight > main.clientHeight + 2 && n++ < 30) {
    main.querySelectorAll(".fit").forEach(e => { e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * 0.95 + "px"; });
  }
}

/* ---------- preview ---------- */
let timer;
const preview = () => { clearTimeout(timer); timer = setTimeout(doPreview, 200); saveDraftSoon(); };
async function doPreview() {
  const t = theme();
  const font = await loadFont(t.font);
  const {root, main} = buildSlide(slides[sel], t, sel, slides.length, font);
  const [w, h] = SIZES[t.size];
  const box = $("frame"), inner = $("inner");
  if (!box.clientWidth) return; // hidden tab on mobile; re-rendered when shown
  const scale = box.clientWidth / w;
  box.style.height = h * scale + "px";
  inner.style.transform = `scale(${scale})`;
  inner.replaceChildren(root);
  fit(main);
  $("pos").textContent = `${sel + 1} / ${slides.length}`;
  renderDots();
}
window.addEventListener("resize", preview);

function goTo(i) { sel = openIdx = Math.max(0, Math.min(slides.length - 1, i)); renderList(); preview(); }
function renderDots() {
  const d = $("dots");
  d.replaceChildren(...slides.map((_, i) => {
    const b = document.createElement("button");
    b.className = i === sel ? "on" : "";
    b.setAttribute("aria-label", "Slide " + (i + 1));
    b.onclick = () => goTo(i);
    return b;
  }));
}
// swipe left/right on the preview to change slide
let sx = null;
$("frame").addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, {passive: true});
$("frame").addEventListener("touchend", e => {
  if (sx === null) return;
  const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) > 40) goTo(sel + (dx < 0 ? 1 : -1));
});

/* ---------- slide list ---------- */
const toData = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });

const EMOJIS = ["🔥","✨","💡","🚀","🎯","✅","❌","⚡","💪","🧠","❤️","😍","😂","🤯","👀","🙌","👉","👇","⬆️","📌","⭐","🏆","💰","📈","⏰","🎉","🌟","💎","🔑","📚","🌱","☀️","🌙","🍕","☕","🎧","📱","💻","🇮🇳","🙏"];
let openIdx = 0;
function renderList() {
  $("slides").innerHTML = "";
  slides.forEach((s, i) => {
    const d = document.createElement("div");
    const isOpen = i === openIdx;
    d.className = "slide" + (i === sel ? " sel" : "") + (isOpen ? "" : " collapsed");
    d.innerHTML = `<div class="hd"><span class="t"><b>${i + 1}</b><em></em></span><span class="chev">▾</span></div>
      <div class="bd"><input data-f="title" placeholder="Title"><textarea data-f="body" placeholder="Body"></textarea>
      <label>Own background for this slide <input type="file" data-f="img" accept="image/*"></label>
      <div class="emo"><label>Emojis &amp; stickers — tap one to add it to the field you last clicked</label>
      <div class="emorow"></div>
      <div class="row"><input data-f="sticker" placeholder="Sticker (big emoji)" maxlength="8">
      <select data-f="stickerPos"><option value="tr">Top right</option><option value="tl">Top left</option><option value="br">Bottom right</option>
      <option value="bl">Bottom left</option><option value="c">Center</option></select>
      <select data-f="stickerSize"><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></div></div>
      <div class="acts"><button data-a="up" title="Move up">↑</button><button data-a="down" title="Move down">↓</button>
      <button data-a="dup">Duplicate</button><button data-a="del" class="del">Delete</button></div></div>`;
    const label = d.querySelector("em");
    const setLabel = () => { label.textContent = s.title || s.body || "(empty)"; };
    setLabel();
    d.querySelector("[data-f=title]").value = s.title;
    d.querySelector("[data-f=body]").value = s.body;
    d.querySelector("[data-f=sticker]").value = s.sticker || "";
    d.querySelector("[data-f=stickerPos]").value = s.stickerPos || "tr";
    d.querySelector("[data-f=stickerSize]").value = s.stickerSize || "m";
    let last = d.querySelector("[data-f=title]");
    d.querySelectorAll("[data-f=title],[data-f=body],[data-f=sticker]").forEach(e => e.addEventListener("focus", () => { last = e; }));
    const row = d.querySelector(".emorow");
    for (const em of EMOJIS) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = em; b.className = "em";
      b.onmousedown = ev => ev.preventDefault();
      b.onclick = ev => {
        ev.stopPropagation();
        if (last.dataset.f === "sticker") last.value = em;
        else {
          const p = last.selectionStart ?? last.value.length;
          last.value = last.value.slice(0, p) + em + last.value.slice(last.selectionEnd ?? p);
          last.setSelectionRange?.(p + em.length, p + em.length);
        }
        last.dispatchEvent(new Event("input"));
      };
      row.appendChild(b);
    }
    d.querySelector(".hd").onclick = () => {
      openIdx = isOpen ? -1 : i; sel = i; renderList(); preview();
    };
    d.querySelectorAll("input[data-f],textarea,select[data-f]").forEach(e => {
      if (e.dataset.f === "img") e.onchange = async () => { s.bg_image = e.files[0] ? await toData(e.files[0]) : null; preview(); };
      else e.oninput = () => { s[e.dataset.f] = e.value; setLabel(); preview(); };
    });
    d.querySelectorAll("button[data-a]").forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const a = b.dataset.a;
      if (a === "del" && slides.length > 1) { slides.splice(i, 1); sel = Math.min(i, slides.length - 1); }
      if (a === "up" && i > 0) { [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]]; sel = i - 1; }
      if (a === "down" && i < slides.length - 1) { [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]]; sel = i + 1; }
      if (a === "dup") { slides.splice(i + 1, 0, {...s}); sel = i + 1; }
      openIdx = sel; renderList(); preview();
    });
    $("slides").appendChild(d);
  });
}

styleIds.forEach(id => $(id).addEventListener("input", preview));
$("bgfile").onchange = async e => {
  bgImage = e.target.files[0] ? await toData(e.target.files[0]) : null;
  if (bgImage) $("bg_type").value = "image";
  preview();
};
$("add").onclick = () => { slides.push({title: "", body: ""}); sel = openIdx = slides.length - 1; renderList(); preview();
  $("slides").lastElementChild.scrollIntoView({block: "nearest", behavior: "smooth"}); };
$("prev").onclick = () => { sel = openIdx = Math.max(0, sel - 1); renderList(); preview(); };
$("next").onclick = () => { sel = openIdx = Math.min(slides.length - 1, sel + 1); renderList(); preview(); };

/* ---------- export: PNGs + caption.txt -> zip ---------- */
function captionText() {
  const tags = $("tags").value.split(/\s+/).filter(Boolean).map(x => x.startsWith("#") ? x : "#" + x).join(" ");
  return ($("caption").value.trim() + "\n\n" + tags).trim() + "\n";
}

async function renderAll() {
  const t = theme();
  const font = await loadFont(t.font);
  const embed = await fontEmbedCss(font);
  const host = $("offscreen"), files = [];
  for (let i = 0; i < slides.length; i++) {
    $("msg").textContent = `Rendering slide ${i + 1} of ${slides.length}…`;
    const {root, main} = buildSlide(slides[i], t, i, slides.length, font);
    host.replaceChildren(root);
    fit(main);
    const dataUrl = await htmlToImage.toPng(root, {pixelRatio: 1, cacheBust: true, fontEmbedCSS: embed});
    files.push({name: `slide_${String(i + 1).padStart(2, "0")}.png`, b64: dataUrl.split(",")[1]});
  }
  host.replaceChildren();
  return files;
}
const b64ToBlob = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: "image/png"}); };

async function busy(btn, fn) {
  $("gen").disabled = $("share").disabled = true;
  try { await fn(); } catch (e) { if (e.name !== "AbortError") $("msg").textContent = "Error: " + e.message; }
  $("gen").disabled = $("share").disabled = false;
}

$("gen").onclick = () => busy($("gen"), async () => {
  const zip = new JSZip();
  for (const f of await renderAll()) zip.file(f.name, f.b64, {base64: true});
  zip.file("caption.txt", captionText());
  const blob = await zip.generateAsync({type: "blob"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "instagram_post.zip";
  a.click();
  $("msg").textContent = "Done — zip downloaded.";
});

// Phone share sheet: pick Instagram and the slides arrive as a carousel (caption is copied to the clipboard).
$("share").onclick = () => busy($("share"), async () => {
  const files = (await renderAll()).map(f => new File([b64ToBlob(f.b64)], f.name, {type: "image/png"}));
  if (!navigator.canShare || !navigator.canShare({files})) {
    $("msg").textContent = "This browser can't share images. Use “Generate & download zip” instead.";
    return;
  }
  try { await navigator.clipboard.writeText(captionText()); } catch {}
  $("msg").textContent = "Caption copied — choose Instagram, then paste it as the caption.";
  await navigator.share({files});
});

/* ---------- AI providers ---------- */
const PROVIDERS = {
  local: {url: "http://localhost:11434/v1", model: "", key: false,
    hint: "Ollama: localhost:11434/v1 · LM Studio: localhost:1234/v1. Tap Detect to list models. " +
      "Ollama needs OLLAMA_ORIGINS=* (then restart); LM Studio needs CORS enabled."},
  anthropic: {url: "https://api.anthropic.com", model: "claude-sonnet-5-5", key: true,
    hint: "Your key is stored only in this browser (localStorage) and sent only to this URL."},
  gemini: {url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", key: true,
    hint: "Get a free key at aistudio.google.com/apikey. Uses Gemini's OpenAI-compatible endpoint. Key stays in this browser."},
  openai: {url: "https://api.openai.com/v1", model: "gpt-4o-mini", key: true,
    hint: "Any OpenAI-compatible service works (OpenAI, OpenRouter, Groq…). Change the base URL and model."},
};

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem("insta-ai") || "{}"); } catch {}
  return s;
}
function saveSettings() {
  const p = $("provider").value;
  const s = loadSettings();
  s.provider = p;
  if (p !== "paste") s[p] = {baseUrl: $("baseUrl").value, apiKey: $("apiKey").value, model: $("model").value};
  try { localStorage.setItem("insta-ai", JSON.stringify(s)); } catch {}
}
function applyProvider() {
  const p = $("provider").value;
  const paste = p === "paste";
  $("cfg-api").classList.toggle("hidden", paste);
  $("cfg-paste").classList.toggle("hidden", !paste);
  $("aiBtn").textContent = paste ? "Load reply" : "AI Generate";
  if (paste) return;
  const d = PROVIDERS[p], saved = loadSettings()[p] || {};
  $("baseUrl").value = saved.baseUrl || d.url;
  $("apiKey").value = saved.apiKey || "";
  $("model").value = saved.model || d.model;
  $("keyRow").classList.toggle("hidden", !d.key);
  $("provHint").textContent = d.hint;
  $("models").innerHTML = "";
}
$("provider").value = loadSettings().provider || "local";
$("provider").onchange = () => { saveSettings(); applyProvider(); };
["baseUrl", "apiKey", "model"].forEach(id => $(id).addEventListener("change", saveSettings));
applyProvider();

$("detect").onclick = async () => {
  $("msg").textContent = "Looking for models…";
  try {
    const base = $("baseUrl").value.replace(/\/$/, "");
    const headers = $("provider").value === "anthropic"
      ? {"x-api-key": $("apiKey").value, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"}
      : ($("apiKey").value ? {Authorization: "Bearer " + $("apiKey").value} : {});
    const isLocal = $("provider").value === "local";
    const getJson = async u => {
      const r = await fetch(u, {headers});
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    };
    let ids, loaded = [], root = base;
    if (isLocal) {
      // Try the URL given, then the other common local server if it is not reachable.
      const candidates = [base, "http://localhost:11434/v1", "http://localhost:1234/v1", "http://127.0.0.1:11434/v1", "http://127.0.0.1:1234/v1"]
        .filter((u, i, a) => a.indexOf(u) === i);
      let err;
      for (const c of candidates) {
        try { ids = (await getJson(c + "/models")).data.map(m => m.id); root = c; break; } catch (e) { err ||= e; }
      }
      if (!ids) throw err;
      const origin = root.replace(/\/v1$/, "");
      // Ollama: models currently loaded in memory.
      try { loaded = (await getJson(origin + "/api/ps")).models.map(m => m.model || m.name); } catch {}
      // LM Studio: models with state "loaded".
      if (!loaded.length) try {
        loaded = (await getJson(origin + "/api/v0/models")).data
          .filter(m => m.state === "loaded" && m.type !== "embeddings").map(m => m.id);
      } catch {}
      loaded = loaded.filter(l => ids.includes(l));
      if (root !== base) $("baseUrl").value = root;
    } else {
      ids = (await getJson($("provider").value === "anthropic" ? base + "/v1/models" : base + "/models")).data.map(m => m.id.replace(/^models\//, ""));
    }
    const chat = ids.filter(i => !/embed|rerank/i.test(i));
    const list = [...loaded, ...chat.filter(i => !loaded.includes(i))];
    $("models").innerHTML = list.map(i => `<option value="${i}">`).join("");
    if (loaded.length) $("model").value = loaded[0];
    else if (list.length && !list.includes($("model").value)) $("model").value = list[0];
    saveSettings();
    $("msg").textContent = `Found ${list.length} model(s)` + (loaded.length ? `; running: ${loaded[0]}.` : ".");
  } catch (e) {
    $("msg").textContent = "Could not reach the server: " + e.message + "\nIs it running, and is CORS allowed for this page?";
  }
};

function systemPrompt() {
  return 'You write Instagram carousel posts that explain generic (non-code) questions. ' +
    'Return ONLY JSON: {"slides":[{"title":str,"body":str}],"caption":str,"hashtags":[str]}. ' +
    'Slide 1 is a hook that restates the question as a curiosity-driven title (no body or a short one). ' +
    'Middle slides each make ONE point: title max 8 words, body max 30 words. ' +
    'The last slide is a closing takeaway or call to action (follow/save/share). ' +
    'Caption: 2-4 short sentences plus a question to drive comments. ' +
    'Hashtags: 10-15, mix of broad and niche, no spaces, each starting with #.';
}
function userPrompt() {
  return `Question: ${$("q").value.trim()}\nSlides: ${$("n").value}\nTone: ${$("tone").value}\nAudience: general audience`;
}

async function callModel() {
  const p = $("provider").value, base = $("baseUrl").value.replace(/\/$/, ""), model = $("model").value.trim();
  if (!model) throw new Error("Choose a model (try Detect).");
  if (p === "anthropic") {
    if (!$("apiKey").value) throw new Error("Enter your API key.");
    const r = await fetch(base + "/v1/messages", {
      method: "POST",
      headers: {"content-type": "application/json", "x-api-key": $("apiKey").value, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"},
      body: JSON.stringify({model, max_tokens: 2000, system: systemPrompt(), messages: [{role: "user", content: userPrompt()}]}),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || r.statusText);
    return j.content.filter(b => b.type === "text").map(b => b.text).join("");
  }
  const headers = {"content-type": "application/json"};
  if ($("apiKey").value) headers.Authorization = "Bearer " + $("apiKey").value;
  const send = () => fetch(base + "/chat/completions", {
    method: "POST", headers,
    body: JSON.stringify({model, temperature: 0.7, stream: false,
      messages: [{role: "system", content: systemPrompt()}, {role: "user", content: userPrompt()}]}),
  });
  let r;
  try { r = await send(); }
  catch {
    // Connection dropped (often a local model still loading or restarting): retry once.
    await new Promise(res => setTimeout(res, 3000));
    try { r = await send(); }
    catch { throw new Error("Connection to " + base + " was closed. Make sure the model is loaded and the server is running (click Detect), then try again."); }
  }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.statusText);
  return j.choices[0].message.content;
}

function parseDeck(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON found in the reply.");
  const d = JSON.parse(m[0]);
  if (!Array.isArray(d.slides) || !d.slides.length) throw new Error("Reply has no slides.");
  return d;
}

function applyDeck(d) {
  slides = d.slides.map(s => ({title: s.title || "", body: s.body || ""}));
  $("caption").value = d.caption || "";
  $("tags").value = (d.hashtags || []).join(" ");
  sel = openIdx = 0; renderList(); preview();
}

$("copyPrompt").onclick = async () => {
  if (!$("q").value.trim()) { $("msg").textContent = "Type your question first."; return; }
  await navigator.clipboard.writeText(systemPrompt() + "\n\n" + userPrompt());
  $("msg").textContent = "Prompt copied. Paste it into a chatbot, then paste the reply here.";
};

$("sharePrompt").onclick = async () => {
  if (!$("q").value.trim()) { $("msg").textContent = "Type your question first."; return; }
  const text = systemPrompt() + "\n\n" + userPrompt();
  if (navigator.share) { try { await navigator.share({text}); return; } catch (e) { if (e.name === "AbortError") return; } }
  await navigator.clipboard.writeText(text);
  $("msg").textContent = "Sharing isn't available here, so the prompt was copied. Paste it into your AI app.";
};
$("pasteReply").onclick = async () => {
  try { $("reply").value = await navigator.clipboard.readText(); }
  catch { $("msg").textContent = "Can't read the clipboard — paste the reply into the box manually."; return; }
  $("aiBtn").click();
};

$("aiBtn").onclick = async () => {
  const paste = $("provider").value === "paste";
  if (!paste && !$("q").value.trim()) { $("msg").textContent = "Type your question first."; return; }
  $("aiBtn").disabled = true;
  const label = $("aiBtn").textContent;
  if (!paste) $("aiBtn").textContent = "Thinking…";
  try {
    saveSettings();
    applyDeck(parseDeck(paste ? $("reply").value : await callModel()));
    $("msg").textContent = "Slides ready — edit freely, then generate.";
    if (mq.matches) showTab("preview");
  } catch (e) {
    $("msg").textContent = "AI error: " + e.message;
  }
  $("aiBtn").disabled = false;
  $("aiBtn").textContent = label;
};

/* ---------- quick themes ---------- */
const THEMES = {
  Midnight: {bg_type: "gradient", bg_color: "#0f172a", bg_color2: "#6d28d9", gradient_angle: 135, text_color: "#ffffff", accent_color: "#facc15", font: "Poppins"},
  Sunset:   {bg_type: "gradient", bg_color: "#7c2d12", bg_color2: "#db2777", gradient_angle: 150, text_color: "#fff7ed", accent_color: "#fde047", font: "Montserrat"},
  Ocean:    {bg_type: "gradient", bg_color: "#082f49", bg_color2: "#0891b2", gradient_angle: 160, text_color: "#ecfeff", accent_color: "#fbbf24", font: "Inter"},
  Forest:   {bg_type: "gradient", bg_color: "#052e16", bg_color2: "#15803d", gradient_angle: 135, text_color: "#f0fdf4", accent_color: "#fcd34d", font: "Lora"},
  Paper:    {bg_type: "solid", bg_color: "#faf7f2", bg_color2: "#faf7f2", gradient_angle: 135, text_color: "#1f2937", accent_color: "#c2410c", font: "Playfair Display"},
  Mono:     {bg_type: "solid", bg_color: "#000000", bg_color2: "#000000", gradient_angle: 135, text_color: "#ffffff", accent_color: "#a3e635", font: "Bebas Neue"},
};
function applyTheme(name) {
  for (const [k, v] of Object.entries(THEMES[name])) $(k).value = v;
  preview();
}
for (const [name, t] of Object.entries(THEMES)) {
  const b = document.createElement("button");
  b.title = name;
  b.style.background = t.bg_type === "solid" ? t.bg_color : `linear-gradient(${t.gradient_angle}deg,${t.bg_color},${t.bg_color2})`;
  b.style.color = t.accent_color;
  b.innerHTML = `Aa<span>${name}</span>`;
  b.onclick = () => applyTheme(name);
  $("themes").appendChild(b);
}

/* ---------- auto-saved draft (this browser only; background images are not saved) ---------- */
const DRAFT_KEY = "insta-draft";
let draftTimer;
function saveDraftSoon() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 500); }
function saveDraft() {
  const style = {};
  for (const id of styleIds) { const e = $(id); style[id] = e.type === "checkbox" ? e.checked : e.value; }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      slides: slides.map(({title, body, sticker, stickerPos, stickerSize}) => ({title, body, sticker, stickerPos, stickerSize})),
      caption: $("caption").value, tags: $("tags").value, q: $("q").value, style}));
  } catch {}
}
function loadDraft() {
  let d;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch {}
  if (!d) return;
  if (Array.isArray(d.slides) && d.slides.length) slides = d.slides;
  $("caption").value = d.caption || ""; $("tags").value = d.tags || ""; $("q").value = d.q || "";
  for (const [id, v] of Object.entries(d.style || {})) {
    const e = $(id); if (!e) continue;
    if (e.type === "checkbox") e.checked = v; else e.value = v;
  }
}
["caption", "tags", "q"].forEach(id => $(id).addEventListener("input", saveDraftSoon));
loadDraft();

renderList();
preview();

/* ---------- mobile tabs ---------- */
const mq = window.matchMedia("(max-width:1000px)");
function showTab(id) {
  if (id === "gen2") { showTab("preview"); $("gen").click(); return; }
  document.querySelectorAll("main>section").forEach(s => s.classList.toggle("show", s.id === id));
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
  window.scrollTo(0, 0);
  preview();
}
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));
showTab("sec-edit");
