(() => {
  const script = document.currentScript;
  if (!script || document.getElementById("mytradieos-website-agent")) return;
  const siteKey = script.dataset.siteKey || "";
  const apiBase = (script.dataset.apiBase || "").replace(/\/$/, "");
  const formEndpoint = script.dataset.formEndpoint || "";
  if (!siteKey || !apiBase) return;

  const sessionId = (crypto.randomUUID ? crypto.randomUUID() : `wa_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const state = { config: null, service: "", urgency: "standard", messages: [] };
  const host = document.createElement("div");
  host.id = "mytradieos-website-agent";
  const root = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  root.innerHTML = `
    <style>
      :host{--wa-navy:#071b2e;--wa-orange:#f97316;--wa-text:#142033;--wa-muted:#64748b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      *{box-sizing:border-box}.launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;border:0;border-radius:999px;background:var(--wa-orange);color:#fff;padding:14px 18px;font:800 15px/1 inherit;box-shadow:0 15px 40px rgba(7,27,46,.28);cursor:pointer}.launcher svg{width:22px;height:22px}
      .panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:min(390px,calc(100vw - 24px));height:min(650px,calc(100dvh - 110px));display:none;overflow:hidden;border:1px solid #dbe4ee;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(7,27,46,.3)}.panel.open{display:flex;flex-direction:column}
      .head{display:flex;align-items:center;justify-content:space-between;background:var(--wa-navy);color:#fff;padding:16px}.head strong{display:block;font-size:16px}.head span{font-size:12px;color:#cbd5e1}.close{border:0;background:transparent;color:#fff;font-size:26px;cursor:pointer}
      .body{flex:1;overflow:auto;padding:16px;background:#f6f8fb}.messages{display:flex;flex-direction:column;gap:10px}.msg{max-width:88%;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.45;white-space:pre-wrap}.bot{align-self:flex-start;border:1px solid #dbe4ee;background:#fff;color:var(--wa-text)}.user{align-self:flex-end;background:var(--wa-navy);color:#fff}
      .quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.quick button{border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:var(--wa-navy);padding:9px 11px;font:700 13px/1 inherit;cursor:pointer}.quick button:hover{border-color:var(--wa-orange)}
      form{display:grid;gap:10px;margin-top:12px}.field{display:grid;gap:5px}.field label{font-size:12px;font-weight:800;color:#334155}.field input,.field textarea,.field select{width:100%;border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:10px;color:var(--wa-text);font:14px/1.35 inherit}.field textarea{min-height:82px;resize:vertical}.hint{font-size:11px;color:var(--wa-muted)}
      .send{border:0;border-radius:9px;background:var(--wa-orange);color:#fff;padding:12px;font:800 14px/1 inherit;cursor:pointer}.send:disabled{opacity:.55;cursor:wait}.emergency{border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#991b1b;padding:11px;font-size:13px;line-height:1.45}.footer{border-top:1px solid #e2e8f0;background:#fff;padding:10px 16px;color:var(--wa-muted);font-size:11px;text-align:center}
      @media(max-width:520px){.launcher{right:12px;bottom:12px}.panel{inset:8px;width:auto;height:auto;border-radius:15px}.panel.open{position:fixed}.launcher.hide{display:none}}
      @media(prefers-reduced-motion:no-preference){.panel.open{animation:wa-in .18s ease-out}@keyframes wa-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}}
    </style>
    <button class="launcher" aria-label="Chat with us" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
      <span>Ask us</span>
    </button>
    <section class="panel" role="dialog" aria-label="Website enquiry assistant" aria-modal="false">
      <header class="head"><div><strong>Website Assistant</strong><span>Usually replies immediately</span></div><button class="close" aria-label="Close chat">×</button></header>
      <main class="body"><div class="messages" aria-live="polite"></div><div class="actions"></div></main>
      <div class="footer">Powered by MyTradieOS</div>
    </section>`;

  const launcher = root.querySelector(".launcher");
  const panel = root.querySelector(".panel");
  const close = root.querySelector(".close");
  const messages = root.querySelector(".messages");
  const actions = root.querySelector(".actions");

  const addMessage = (text, who = "bot") => {
    const item = document.createElement("div");
    item.className = `msg ${who}`;
    item.textContent = text;
    messages.appendChild(item);
    state.messages.push(`${who === "bot" ? "Agent" : "Visitor"}: ${text}`);
    item.scrollIntoView({ block: "end", behavior: "smooth" });
  };

  const postEvent = (event) => {
    fetch(`${apiBase}/api/v1/website-agent/event`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteKey, sessionId, event, sourceUrl: location.href }),
    }).catch(() => {});
  };

  const showEmergency = () => {
    actions.innerHTML = `<div class="emergency"><strong>Possible electrical emergency</strong><br>Keep clear of sparks, smoke, burning smells or exposed wiring. If anyone is in immediate danger, call <strong>000</strong>. Otherwise call <a href="tel:${(state.config.emergencyPhone || "").replace(/[^+\d]/g, "")}">${state.config.emergencyPhone || "the electrical team"}</a>.</div><div class="quick"><button data-next="form">Send the job details</button><button data-next="restart">Start again</button></div>`;
    postEvent("emergency_redirect");
  };

  const showForm = () => {
    actions.innerHTML = `
      <form>
        <div class="field"><label for="wa-name">Name *</label><input id="wa-name" name="name" autocomplete="name" required maxlength="120"></div>
        <div class="field"><label for="wa-phone">Phone *</label><input id="wa-phone" name="phone" autocomplete="tel" inputmode="tel" required maxlength="40"></div>
        <div class="field"><label for="wa-email">Email</label><input id="wa-email" name="email" type="email" autocomplete="email" maxlength="160"></div>
        <div class="field"><label for="wa-suburb">Suburb *</label><input id="wa-suburb" name="suburb" autocomplete="address-level2" required maxlength="100"></div>
        <div class="field"><label for="wa-message">Job details *</label><textarea id="wa-message" name="message" required maxlength="3000" placeholder="What needs doing, and when?"></textarea></div>
        <div class="field"><label for="wa-photos">Photos (optional)</label><input id="wa-photos" name="photos" type="file" accept="image/*" multiple><span class="hint">Add up to five useful photos. Avoid private documents.</span></div>
        <input name="companyWebsite" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
        <button class="send" type="submit">Send enquiry</button>
        <span class="hint">Your details will be sent securely to ${state.config.brandName} so the team can contact you.</span>
      </form>`;
  };

  const chooseService = () => {
    const services = state.config.services || [];
    actions.innerHTML = `<div class="quick">${services.slice(0, 10).map((service) => `<button data-service="${service.replace(/"/g, "&quot;")}">${service}</button>`).join("")}<button data-service="Other electrical work">Something else</button><button data-next="emergency">Urgent safety issue</button></div>`;
  };

  const start = () => {
    messages.innerHTML = "";
    state.messages = [];
    actions.innerHTML = "";
    addMessage(state.config.welcomeMessage || `Hi! I'm the ${state.config.brandName} website assistant. How can I help?`);
    addMessage("I can help identify the right service and send your job details to the team.");
    chooseService();
    postEvent("started");
  };

  const loadConfig = async () => {
    const response = await fetch(`${apiBase}/api/v1/website-agent/config?siteKey=${encodeURIComponent(siteKey)}`);
    if (!response.ok) throw new Error("Agent unavailable");
    state.config = await response.json();
    root.querySelector(".head strong").textContent = `${state.config.brandName} Assistant`;
    start();
  };

  launcher.addEventListener("click", async () => {
    const opening = !panel.classList.contains("open");
    panel.classList.toggle("open", opening);
    launcher.setAttribute("aria-expanded", String(opening));
    launcher.classList.toggle("hide", opening);
    if (opening && !state.config) {
      actions.innerHTML = "";
      addMessage("Connecting you with the team…");
      try { await loadConfig(); postEvent("opened"); }
      catch { messages.innerHTML = ""; addMessage("The chat is temporarily unavailable. Please use the quote form or call us."); }
    }
  });
  close.addEventListener("click", () => {
    panel.classList.remove("open"); launcher.classList.remove("hide"); launcher.setAttribute("aria-expanded", "false");
  });

  actions.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.service) {
      state.service = button.dataset.service;
      addMessage(state.service, "user");
      addMessage("Thanks. Tell me a little about the job and the team will review it.");
      showForm();
    } else if (button.dataset.next === "emergency") {
      state.urgency = "emergency"; addMessage("This may be an urgent safety issue.", "user"); showEmergency();
    } else if (button.dataset.next === "form") showForm();
    else if (button.dataset.next === "restart") start();
  });

  actions.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector(".send");
    const data = new FormData(form);
    if (data.get("companyWebsite")) return;
    const files = Array.from(form.querySelector("#wa-photos").files || []).slice(0, 5);
    const message = String(data.get("message") || "");
    const emergencyWords = /sparks?|smoke|burning smell|fire|electric shock|live wire|exposed wire/i;
    if (emergencyWords.test(message)) state.urgency = "emergency";
    button.disabled = true; button.textContent = "Sending…";

    const lead = {
      siteKey, sessionId,
      name: String(data.get("name") || ""),
      phone: String(data.get("phone") || ""),
      email: String(data.get("email") || ""),
      suburb: String(data.get("suburb") || ""),
      service: state.service || "Electrical enquiry",
      message,
      urgency: state.urgency,
      photoUrls: [],
      transcript: state.messages.join("\n"),
      sourceUrl: location.href,
    };

    try {
      const photoStorageIds = await Promise.all(files.map(async (file) => {
        const upload = new FormData();
        upload.append("siteKey", siteKey);
        upload.append("sessionId", sessionId);
        upload.append("photo", file);
        const response = await fetch(`${apiBase}/api/v1/website-agent/upload`, {
          method: "POST",
          body: upload,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Photo upload failed");
        }
        const result = await response.json();
        return result.storageId;
      }));
      lead.photoStorageIds = photoStorageIds;
      delete lead.photoUrls;

      const response = await fetch(`${apiBase}/api/v1/website-agent/lead`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead),
      });
      if (!response.ok) throw new Error("Lead delivery failed");


      addMessage(`Thanks, ${lead.name}. Your enquiry has been sent to the team. They'll contact you using ${lead.phone}.`, "bot");
      actions.innerHTML = state.urgency === "emergency"
        ? `<div class="emergency">If there is immediate danger, call <strong>000</strong>. Otherwise call ${state.config.emergencyPhone || "the team"} now.</div>`
        : `<div class="quick"><button data-next="restart">Send another enquiry</button></div>`;
    } catch {
      button.disabled = false; button.textContent = "Try again";
      addMessage("I couldn't send that enquiry. Please use the website quote form or call the team.", "bot");
    }
  });
})();
