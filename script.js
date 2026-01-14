/* ==========================================================
   0) STATE FIRST (no TDZ errors)
========================================================== */

// DOM
const view = document.getElementById("view");
const caption = document.getElementById("caption");
const navToggle = document.getElementById("nav-toggle");
const nav = document.querySelector(".nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    nav.classList.toggle("is-visible");
  });
}

// Canvas
const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d", { alpha: false });

let W = 0, H = 0, dpr = 1;

// Global field state
const field = {
  mode: "pointcloud",
  cursorX: 0.5,
  cursorY: 0.5,
  lastX: 0.5,
  lastY: 0.5,
  waveEnergy: 0,
  hoverTarget: 0, // 0 or 1
  hoverCurrent: 0, // smoothed value
  feedbackOpacity: 0.25 // starts clean
};

let motionOn = true;

// Network state
let nodes = [];
const N = 70;

// Pointcloud state
let cloud = [];
let cloudReady = false;

// rotation state
let rotX = 0, rotY = 0;
let targetRotX = 0, targetRotY = 0;

// time for cyber-ish motion
let time = 0;

// projection / placement
const proj = {
  fov: 600,
  scale: 1,
  centerX: 0.5,
  centerY: 0.47
};

// Atmospheric settings
const atmos = {
  layers: [
    { id: 0, name: "far",  driftSpeed: 0.05, parallax: 0.05, alpha: 0.25, sizeMod: 0.6 },
    { id: 1, name: "mid",  driftSpeed: 0.12, parallax: 0.15, alpha: 0.55, sizeMod: 1.0 },
    { id: 2, name: "near", driftSpeed: 0.20, parallax: 0.30, alpha: 0.90, sizeMod: 1.3 }
  ],
  cube: {
    size: 1.0,       // relative to normalized cloud
    color: "rgba(255,255,255,0.25)",
    thickness: 1,
    rotRange: 1.45,   // +/- radians (approx 25 degrees)
    smooth: 0.05      // lerp factor
  }
};

// deformation settings (RESTORED)
const deform = {
  enabled: true,
  baseAmp: 0.020,
  speed: 2.8,
  f1: 48.0,
  f2: 56.0,
  f3: 64.0,
  zAmp: 0.35
};

/* ==========================================================
   PERFORMANCE KNOBS
========================================================== */

const MAX_DRAW_POINTS = 120000;
const MAX_LOAD_POINTS = 400000;
const DPR_CAP = 1.5;

const USE_COLOR_BUCKETS = false; // Disable buckets for layer-based rendering
const COLOR_BUCKETS = 64;

/* ==========================================================
   HELPER: 3D TRANSFORM
========================================================== */
function rotate3D(x, y, z, cx, sx, cy, sy){
  // Yaw (Y-axis)
  let x1 = x*cy + z*sy;
  let z1 = -x*sy + z*cy;
  // Pitch (X-axis)
  let y2 = y*cx - z1*sx;
  let z2 = y*sx + z1*cx;
  return [x1, y2, z2];
}

/* ==========================================================
   STAGE PANEL (REMOVED - using 3D Cube now)
========================================================== */
// (Functions removed to keep file clean)

/* ==========================================================
   CONTENT + ROUTING
========================================================== */

const DATA = {
  home: { title: "Home", body: [] },
  about: {
    title: "About",
    body: [
      "Costas Philippou is a multimedia artist working across interactive digital environments, immersive installations, and sound-driven experiences. His practice combines real-time visual tools, game engines, coding, and audiovisual processes to explore how digital spaces are perceived, inhabited, and shaped through interaction.",
      "Through installations, net-based works, and spatial audiovisual compositions, Philippou creates environments where the presence and actions of the viewer actively influence the form of the work. Rather than fixed narratives, his projects emphasize experience, embodiment, and co-creation, positioning interaction as a central compositional element.",
      "He holds an integrated MA/BA in Fine and Applied Arts from the University of Western Macedonia and is currently based in Cyprus."
    ]
  },
  cv: {
    title: "CV",
    body: [
      "2025",
      "• Othello’s Fever (presentation within the After Malaria project), Pantheon Cinema, Nicosia",
      "2023",
      "• Turning Point, Buffer Fringe Performing Arts Festival, Home for Cooperation, Nicosia",
      "• Thesis Exhibition, University of Western Macedonia, Florina",
      "• Socially Oblique, To Pikap Kato & The Room, Thessaloniki",
      "• Osten Biennial of Drawing 2022, National Gallery Cifte Hammam, Skopje",
      "2022",
      "• ICONA – Ionian Contemporary Animation Festival, Juried Selection (Online)",
      "• Art-Thessaloniki International Fair, Thessaloniki",
      "• Stigma, Municipal Gallery of Piraeus",
      "• Animex Festival, Middlesbrough Town Hall, UK",
      "2021",
      "• Networks, Mapping Projection, Florina",
      "• Platform Project 2020–2021, Independent Art Fair, Athens School of Fine Arts, Athens",
      "Awards",
      "• Student VFX Award — Animex Festival, UK (2022)",
      "• Special Award for Group Presentation — Osten Biennial of Drawing (2023)",
      "Education",
      "Integrated MA/BA, Fine and Applied Arts",
      "University of Western Macedonia, Greece (2018–2023)"
    ]
  },
  contact: {
    title: "Contact",
    body: [
      "Email: costas.ph97@gmail.com",
      "Instagram: @Costas Philippou",
      "GitHub: cph97"
    ]
  }
};

const WORKS = [
  { 
    id: "robot", 
    title: "Are you a robot? Aren't you?  --   Interactive web-based installation · Generative audiovisual system", 
    meta: "2025", 
    bg: "assets/areYouaRobot.jpg",
    desc: "Are you a robot, aren't you? is an interactive web-based installation that transforms the familiar CAPTCHA verification process into a generative audiovisual experience. The work confronts users with an endless sequence of verification pop-ups, text decoding tasks, image selection grids, sliders, and stability tests, each producing distinct sound events as they are triggered, clicked, or completed. Through interaction, the viewer unintentionally composes a dynamic soundscape while navigating an interface designed to assess, classify, and authenticate them. By amplifying the mechanics of verification, the piece exposes the tension between human agency and automated decision-making systems. The repetitive logic of CAPTCHA becomes a performative loop, where the user oscillates between being a subject of control and an active co-creator of the audiovisual environment. The work reflects on digital labour, identity validation, and machine-driven gatekeeping, inviting viewers to experience the act of “proving you are human” as both playful and unsettling.",
    media: [
      { type: "youtube", src: "https://www.youtube.com/embed/5QGBgd6HQm0" }
    ]
  },
  { 
    id: "othellos", 
    title: "Othello’s Fever  --   Immersive real-time installation", 
    meta: "2025", 
    bg: "assets/othellosFever.jpg",
    desc: "Othello’s Fever is an immersive real-time installation that reinterprets Shakespeare’s Othello as a fragmented, hallucinatory environment shaped by disease, paranoia, and psychological breakdown. The work unfolds as a first-person spatial experience, where the viewer navigates a looping architectural labyrinth populated by shifting scenes, voices, and audiovisual disturbances. As the participant moves through the space, the environment reacts through dynamic lighting, sound, and visual effects, gradually destabilizing spatial continuity and narrative coherence. Recurrent elements such as corridors, thresholds, and biological motifs function as triggers that alter the atmosphere, producing moments of disorientation and temporal repetition. The experience resists linear storytelling, instead constructing meaning through accumulation, recurrence, and sensory saturation. By translating Othello’s inner turmoil into a responsive digital space, the work explores themes of jealousy, contagion, and loss of control, drawing parallels between emotional collapse and bodily infection. Othello’s Fever reflects on how classical narratives can be reactivated through immersive systems, using real-time technologies to transform psychological states into spatial and affective conditions experienced directly by the viewer.",
    media: [
      { type: "youtube", src: "https://www.youtube.com/embed/_0R7C8-K83E" }
    ]
  },
  { 
    id: "cloud", 
    title: "cloud.torrent  --   Multimedia interactive installation", 
    meta: "2023", 
    bg: "assets/cloudTorrent.jpg",
    desc: "Cloud.torrent is a multimedia and interactive installation centered around a three-dimensional cloud structure installed on a rooftop. The work invites viewers into a participatory environment where interaction generates sound and movement, activating the cloud as a responsive spatial instrument. Real-time visuals, processed through computer vision systems, are projected directly onto the cloud’s surface, transforming it into a dynamic interface between physical presence and digital perception. The installation frames the cloud as a collective monument suspended in the sky, a shared repository of fragile memories and latent histories. While the form appears phenomenally still, it remains conceptually unbounded, continuously shaped by the presence and actions of its participants. Interaction does not aim at a predefined outcome, but rather at a gradual accumulation of gestures, signals, and responses. Through its multisensory composition, Cloud.torrent reflects on the possibility of a “Turning Point” emerging through collective engagement rather than singular events. By merging material structure, real-time computation, and audience interaction, the work proposes art and technology not as tools of resolution, but as conditions for imagining transformation within shared spaces.",
    media: [
      { type: "youtube", src: "https://www.youtube.com/embed/TKxM8yhmfYs" }
    ]
  },
  { 
    id: "untitled", 
    title: "Untitled, Thesis Project  --   Collaborative in-situ installation", 
    meta: "2023", 
    bg: "assets/untitled.JPG",
    desc: "Untitled is a collaborative, site-specific installation combining interactive sound, video projection, and painterly works within a shared spatial environment. The installation unfolds through the reflection and distortion of material surfaces, where light, sound, and static imagery converge to form a multisensory condition shaped by perception, memory, and embodied experience. As viewers move through the space, interaction activates multiple potential states of the work, positioning the audience as co-creators rather than passive observers. Visual fragments of a bio-organic environment in a state of transformation are dispersed throughout the installation, perceived through material distortion and amplified by the presence of altered sound waves and mathematically driven visual forms emerging from the interaction between light and matter. The convergence of multiple projections and media constructs an environment of apparent complexity that arises from the application of simple rules and interactions. Meaning is not predefined but emerges through dialogue, communication, and relational processes within the space. The work exists as a system of interdependencies, reaching its full form only through the presence and participation of the viewer.",
    media: [
      { type: "youtube", src: "https://www.youtube.com/embed/AM1x5XF4tvQ" }
    ]
  },
  { 
    id: "annoying", 
    title: "The Annoying Tree  --   Architectural projection mapping installation", 
    meta: "2021", 
    bg: "assets/Mapping_Projection.jpg",
    desc: "The Annoying Tree is a projection mapping installation developed on the façade of a building, transforming architectural surfaces into a dynamic audiovisual field. The work unfolds through a particle-based system that forms the silhouette of a tree, composed of mirrored video fragments captured from a forest environment, combined with three-dimensional digital objects. Through continuous motion and repetition, the projected elements disrupt the stability of the building’s surface, blurring the boundary between natural imagery and synthetic form. The tree does not appear as a fixed representation, but as a fluctuating structure, constantly reassembled through particles, reflections, and spatial distortion. Architectural features become part of the composition, shaping the behavior of the projected system rather than serving as a neutral backdrop. By situating a generative, bio-inspired form onto an urban structure, The Annoying Tree reflects on the friction between natural systems and constructed environments. The installation positions projection mapping as a process of interference, where digital matter temporarily inhabits architecture, producing a persistent and slightly intrusive presence within public space.",
    media: [
      { type: "youtube", src: "https://www.youtube.com/embed/Ika8_IhkfmI" }
    ]
  }
];

function setActive(route){
  document.querySelectorAll(".navlink").forEach(a => {
    a.classList.toggle("is-active", a.dataset.route === route);
  });
}

function renderPage(route){
  const page = DATA[route] || DATA.about;
  
  view.innerHTML = `
    <div class="page-content page-${route}">
      <h1 class="h1">${escapeHtml(page.title)}</h1>
      ${page.body.map(t => `<p class="p">${escapeHtml(t)}</p>`).join("")}
    </div>
  `;
}

function renderWork(){
  const list = WORKS.map(w => `
    <div class="workitem" data-work="${w.id}">
      <div class="wtitle">${escapeHtml(w.title)}</div>
      <div class="wmeta">${escapeHtml(w.meta)}</div>
    </div>
  `).join("");

  view.innerHTML = `
    <h1 class="h1">Work</h1>
    <p class="p">A compact index. Click a work to view details.</p>
    <div class="worklist">${list}</div>
    <div id="detail" class="detail" style="display:none"></div>
  `;

  view.querySelectorAll("[data-work]").forEach(el => {
    el.addEventListener("click", () => {
      const w = WORKS.find(x => x.id === el.dataset.work);
      if(!w) return;

      // Build media HTML
      let mediaHtml = "";
      if(w.media && w.media.length){
        mediaHtml = `<div class="media-container">
          ${w.media.map(m => {
            if(m.type === "image"){
               return `<div class="media-item">
                 <img src="${m.src}" alt="${escapeHtml(m.caption||'')}" loading="lazy">
                 ${m.caption ? `<div class="media-caption">${escapeHtml(m.caption)}</div>` : ''}
               </div>`;
            } else if(m.type === "youtube"){
               // Convert embed URL to watch URL for the fallback link
               const watchUrl = m.src.replace("/embed/", "/watch?v=");
               
               // Clean URL + add origin parameter for trusted playback
               const origin = window.location.origin;
               const embedSrc = `${m.src}?origin=${origin}&rel=0`;
               
               return `<div class="media-item">
                 <div class="video-wrapper">
                   <iframe 
                     src="${embedSrc}" 
                     title="YouTube video player" 
                     frameborder="0" 
                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                     allowfullscreen>
                   </iframe>
                 </div>
                 <div class="media-caption">
                   <a href="${watchUrl}" target="_blank" style="color:var(--fg);text-decoration:underline;">Watch on YouTube ↗</a>
                   ${m.caption ? ` — ${escapeHtml(m.caption)}` : ''}
                 </div>
               </div>`;
            } else if(m.type === "video"){
               return `<div class="media-item">
                 <video src="${m.src}" controls playsinline></video>
                 ${m.caption ? `<div class="media-caption">${escapeHtml(m.caption)}</div>` : ''}
               </div>`;
            }
            return "";
          }).join("")}
        </div>`;
      }
      
      const detail = document.getElementById("detail");
      detail.style.display = "block";

      // Apply background if available
      if(w.bg){
        detail.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url('${w.bg}')`;
        detail.style.backgroundSize = "cover";
        detail.style.backgroundPosition = "center";
      } else {
        detail.style.backgroundImage = "none";
      }

      detail.innerHTML = `
        <div class="detail-grid">
            <div class="detail-text">
                <div class="wtitle">${escapeHtml(w.title)}</div>
                <p class="p" style="margin-top:20px">${escapeHtml(w.desc)}</p>
            </div>
            <div class="detail-media">
                ${mediaHtml}
            </div>
        </div>
      `;
      
      // Scroll to detail
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function render(route){
  route = route || "home";
  setActive(route);

  // Toggle Cloud CTA visibility
  const cta = document.getElementById("cloud-cta");
  if(cta) cta.style.display = (route === "home") ? "block" : "none";

  if(route === "home"){
    field.mode = "pointcloud";
    caption.textContent = "Home.";
    renderPage("home");
    return;
  }

  if(route === "work"){
    field.mode = "none";
    caption.textContent = "Work index.";
    renderWork();
    return;
  }

  field.mode = "pointcloud";
  caption.textContent = "System field.";
  renderPage(route);
}

// nav clicks
document.querySelectorAll(".navlink").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Close nav if open
    if(nav && nav.classList.contains("is-visible")){
      nav.classList.remove("is-visible");
    }

    location.hash = a.dataset.route;
  });
  
  // Hover effects on pointcloud
  a.addEventListener("pointerenter", () => {
    field.hoverTarget = 1.0;
  });
  a.addEventListener("pointerleave", () => {
    field.hoverTarget = 0.0;
  });
});

// hash routing
window.addEventListener("hashchange", () => {
  render((location.hash || "#home").slice(1));
});

// initial render
render((location.hash || "#home").slice(1));

/* ==========================================================
   CANVAS + INPUT
========================================================== */

function resize(){
  dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

  canvas.width  = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth + "px";
  canvas.style.height = innerHeight + "px";

  W = canvas.width;
  H = canvas.height;

  proj.scale = Math.min(W, H) * 0.95;

  initNetwork();
}

window.addEventListener("resize", resize);
resize();

window.addEventListener("pointermove", (e) => {
  field.cursorX = e.clientX / innerWidth;
  field.cursorY = e.clientY / innerHeight;
});

/* ==========================================================
   NETWORK BACKGROUND (non-Home)
========================================================== */

function initNetwork(){
  nodes = Array.from({ length: N }, () => ({
    x: Math.random()*W,
    y: Math.random()*H,
    vx: (Math.random() - 0.5) * 0.25 * dpr,
    vy: (Math.random() - 0.5) * 0.25 * dpr
  }));
}

function stepNetwork(){
  for(const p of nodes){
    p.x += p.vx;
    p.y += p.vy;
    if(p.x < 0 || p.x > W) p.vx *= -1;
    if(p.y < 0 || p.y > H) p.vy *= -1;
  }
}

function drawNetwork(){
  ctx.fillStyle = getCSS("--bg") || "#000000";
  ctx.fillRect(0,0,W,H);

  const max = 160 * dpr;
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx*dx + dy*dy;
      if(d2 > max*max) continue;

      const t = 1 - Math.sqrt(d2)/max;
      ctx.strokeStyle = `rgba(255,255,255,${0.06*t})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

/* ==========================================================
   POINTCLOUD LOADING
========================================================== */

async function loadPointCloud(){
  // Try PLY first (much smaller/faster)
  const urls = [
    "assets/Purple_Flowers_merged.ply",
    "Purple_Flowers_merged.ply"
  ];

  const hit = await fetchFirstOk(urls);

  if(!hit){
    cloud = generateSphereCloud(Math.min(MAX_LOAD_POINTS, 120000), true);
    finishCloud();
    return;
  }

  let buffer;
  try {
    buffer = await hit.res.arrayBuffer();
  } catch(e) {
    console.error("PLY buffer error:", e);
    cloud = generateSphereCloud(Math.min(MAX_LOAD_POINTS, 120000), true);
    finishCloud();
    return;
  }

  // Brief pause to let UI update
  await new Promise(r => setTimeout(r, 20));

  try {
    cloud = await parsePlyAsync(buffer, MAX_LOAD_POINTS);
  } catch(e) {
    console.error("PLY parse error:", e);
    cloud = [];
  }

  if(!cloud.length){
    console.warn("PLY empty/failed -> fallback sphere");
    cloud = generateSphereCloud(Math.min(MAX_LOAD_POINTS, 120000), true);
  }

  finishCloud();
}

function finishCloud(){
  normalizeCloud(cloud);
  cloudReady = true;
  buildColorBucketsIfNeeded();
}

async function fetchFirstOk(urls){
  for(const url of urls){
    try{
      const res = await fetch(url, { cache: "no-store" });
      if(res.ok) return { url, res };
    }catch(e){
    }
  }
  return null;
}

function findHeaderEnd(buffer){
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  const scanLimit = Math.min(len, 4096); 
  
  // Look for "end_header"
  for(let i=0; i<scanLimit - 10; i++){
    if(bytes[i]===101 && bytes[i+1]===110 && bytes[i+2]===100 && bytes[i+3]===95 &&
       bytes[i+4]===104 && bytes[i+5]===101 && bytes[i+6]===97 && bytes[i+7]===100 &&
       bytes[i+8]===101 && bytes[i+9]===114) {
         
         let pos = i + 10;
         while(pos < scanLimit){
           if(bytes[pos] === 10) return pos; // LF found
           pos++;
         }
         return i + 10;
    }
  }
  return -1;
}

async function parsePlyAsync(buffer, maxPts=400000){
  const headerEnd = findHeaderEnd(buffer);
  if(headerEnd < 0){
    return [];
  }

  const decoder = new TextDecoder("utf-8");
  const headerText = decoder.decode(buffer.slice(0, headerEnd));
  const headerLines = headerText.split(/\r?\n/);

  let vertexCount = 0;
  let properties = [];
  let isBinaryLE = false;

  for(const line of headerLines){
    const parts = line.trim().split(/\s+/);
    if(parts.length < 2) continue;
    
    if(parts[0] === "format"){
      if(parts[1] === "binary_little_endian") isBinaryLE = true;
    }
    else if(parts[0] === "element"){
      if(parts[1] === "vertex") vertexCount = parseInt(parts[2], 10);
    }
    else if(parts[0] === "property"){
      if(parts.length >= 3) properties.push({ type: parts[1], name: parts[2] });
    }
  }

  if(!isBinaryLE){
    return [];
  }

  if(vertexCount === 0){
    return [];
  }

  // Calc stride
  let stride = 0;
  const propsMap = [];
  for(const p of properties){
    let size = 0;
    if(p.type === "float") size = 4;
    else if(p.type === "uchar" || p.type === "uint8") size = 1;
    else if(p.type === "int") size = 4;
    else if(p.type === "double") size = 8;
    else if(p.type === "short") size = 2;
    
    propsMap.push({ name: p.name, offset: stride, type: p.type });
    stride += size;
  }
  
  if(stride === 0){
    return [];
  }

  const dataView = new DataView(buffer);
  const bodyStart = headerEnd + 1; 
  const totalSize = buffer.byteLength;
  
  if(bodyStart >= totalSize) {
    return [];
  }

  const step = Math.max(1, Math.floor(vertexCount / maxPts));
  const pts = [];

  const isStandard = (
    properties.length >= 6 &&
    properties[0].name==="x" && properties[0].type==="float" &&
    properties[1].name==="y" && properties[1].type==="float" &&
    properties[2].name==="z" && properties[2].type==="float" &&
    (properties[3].name==="red"||properties[3].name==="r") && (properties[3].type==="uchar"||properties[3].type==="uint8") &&
    (properties[4].name==="green"||properties[4].name==="g") && (properties[4].type==="uchar"||properties[4].type==="uint8") &&
    (properties[5].name==="blue"||properties[5].name==="b") && (properties[5].type==="uchar"||properties[5].type==="uint8")
  );

  let lastYield = performance.now();

  for(let i=0; i<vertexCount; i+=step){
    const offset = i * stride;
    const currentPos = bodyStart + offset;
    
    if(currentPos + stride > totalSize) break;

    // Yield logic - force update every 50ms or 2000 points
    if(pts.length % 2000 === 0){
      const now = performance.now();
      if(now - lastYield > 16){
        await new Promise(r => setTimeout(r, 0));
        lastYield = performance.now();
      }
    }

    if(isStandard){
      const x = dataView.getFloat32(currentPos, true);
      const y = dataView.getFloat32(currentPos+4, true);
      const z = dataView.getFloat32(currentPos+8, true);
      const r = dataView.getUint8(currentPos+12);
      const g = dataView.getUint8(currentPos+13);
      const b = dataView.getUint8(currentPos+14);
      pts.push({x,y,z,r,g,b});
    } else {
      let x=0, y=0, z=0, r=null, g=null, b=null;
      for(const prop of propsMap){
        const pOff = currentPos + prop.offset;
        if(prop.type === "float"){
          const val = dataView.getFloat32(pOff, true);
          if(prop.name === "x") x = val;
          else if(prop.name === "y") y = val;
          else if(prop.name === "z") z = val;
          else if(prop.name === "red" || prop.name === "r") r = val * 255;
          else if(prop.name === "green" || prop.name === "g") g = val * 255;
          else if(prop.name === "blue" || prop.name === "b") b = val * 255;
        } else if(prop.type === "uchar" || prop.type === "uint8"){
          const val = dataView.getUint8(pOff);
          if(prop.name === "red" || prop.name === "r") r = val;
          else if(prop.name === "green" || prop.name === "g") g = val;
          else if(prop.name === "blue" || prop.name === "b") b = val;
        }
      }
      const obj = {x,y,z};
      if(r!==null) { obj.r=r; obj.g=g; obj.b=b; }
      pts.push(obj);
    }
  }

  return pts;
}

function normalizeCloud(pts){
  let minX=Infinity,minY=Infinity,minZ=Infinity;
  let maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;

  for(const p of pts){
    if(p.x<minX) minX=p.x; if(p.x>maxX) maxX=p.x;
    if(p.y<minY) minY=p.y; if(p.y>maxY) maxY=p.y;
    if(p.z<minZ) minZ=p.z; if(p.z>maxZ) maxZ=p.z;
  }

  const cx = (minX + maxX)/2;
  const cy = (minY + maxY)/2;
  const cz = (minZ + maxZ)/2;

  const s = Math.max(maxX-minX, maxY-minY, maxZ-minZ) || 1;

  for(const p of pts){
    p.x = (p.x - cx) / s;
    p.y = (p.y - cy) / s;
    p.z = (p.z - cz) / s;

    // Assign to depth layer
    const r = Math.random();
    if(r < 0.25) p.layer = 0;      // Far
    else if(r < 0.85) p.layer = 1; // Mid
    else p.layer = 2;              // Near
  }
}

function generateSphereCloud(n, colored=false){
  const pts = [];
  for(let i=0;i<n;i++){
    const u = Math.random();
    const v = Math.random();
    const theta = 2*Math.PI*u;
    const phi = Math.acos(2*v-1);
    const rr = 0.86 + Math.random()*0.14;

    const x = rr*Math.sin(phi)*Math.cos(theta);
    const y = rr*Math.cos(phi);
    const z = rr*Math.sin(phi)*Math.sin(theta);

    if(colored){
      const R = clamp((x*0.5+0.5)*255,0,255);
      const G = clamp((y*0.5+0.5)*255,0,255);
      const B = clamp((z*0.5+0.5)*255,0,255);
      pts.push({ x,y,z, r:R,g:G,b:B });
    }else{
      pts.push({ x,y,z });
    }
  }
  return pts;
}

/* ==========================================================
   COLOR (procedural + RGB buckets)
========================================================== */

function lerp(a,b,t){ return a + (b-a)*t; }

function paletteLilac(t){
  t = clamp(t,0,1);
  const c1 = [120,  78, 255];
  const c2 = [190, 145, 255];
  const c3 = [ 80, 255, 245];
  const c4 = [255, 255, 255];

  let a,b,local;
  if(t < 0.33){ a=c1; b=c2; local=t/0.33; }
  else if(t < 0.66){ a=c2; b=c3; local=(t-0.33)/0.33; }
  else { a=c3; b=c4; local=(t-0.66)/0.34; }

  return [
    Math.round(lerp(a[0], b[0], local)),
    Math.round(lerp(a[1], b[1], local)),
    Math.round(lerp(a[2], b[2], local))
  ];
}

let rgbBuckets = null;
let hasRGBGlobal = false;

function buildColorBucketsIfNeeded(){
  rgbBuckets = null;
  hasRGBGlobal = cloud.length
    ? (cloud[0].r !== undefined && cloud[0].g !== undefined && cloud[0].b !== undefined)
    : false;

  if(!USE_COLOR_BUCKETS || !hasRGBGlobal || !cloud.length) return;

  rgbBuckets = Array.from({length: COLOR_BUCKETS}, () => []);

  for(let i=0;i<cloud.length;i++){
    const p = cloud[i];
    const r2 = (p.r >> 6) & 3;
    const g2 = (p.g >> 6) & 3;
    const b2 = (p.b >> 6) & 3;
    const idx = (r2<<4) | (g2<<2) | (b2);
    rgbBuckets[idx].push(i);
  }
}

/* ==========================================================
   DRAW POINTCLOUD (Atmospheric + Cube)
========================================================== */

function drawWireframeCube(cx, cy, rx, ry){
  const size = Math.min(W, H) * 0.35 * atmos.cube.size;
  
  // Vertices
  const v = [
    [-1,-1,-1], [1,-1,-1], [1, 1,-1], [-1, 1,-1],
    [-1,-1, 1], [1,-1, 1], [1, 1, 1], [-1, 1, 1]
  ];

  // Rotate
  const sx = Math.sin(rx), cxVal = Math.cos(rx);
  const sy = Math.sin(ry), cyVal = Math.cos(ry);

  const projected = v.map(p => {
    const [nx, ny, nz] = rotate3D(p[0], p[1], p[2], cxVal, sx, cyVal, sy);
    // Weak perspective
    const depth = 1 + nz * 0.2; 
    return {
      x: cx + nx * size,
      y: cy + ny * size
    };
  });

  ctx.strokeStyle = atmos.cube.color;
  ctx.lineWidth = atmos.cube.thickness;
  ctx.beginPath();
  const lines = [
    [0,1], [1,2], [2,3], [3,0], // Back
    [4,5], [5,6], [6,7], [7,4], // Front
    [0,4], [1,5], [2,6], [3,7]  // Sides
  ];
  lines.forEach(([i,j]) => {
    ctx.moveTo(projected[i].x, projected[i].y);
    ctx.lineTo(projected[j].x, projected[j].y);
  });
  ctx.stroke();
}

function drawPointCloud(){
  // 1) Clear (Feedback loop)
  // Instead of clearing instantly, we draw a semi-transparent rect of the BG color.
  // Low opacity = long trails. High opacity = fast clear.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = getCSS("--bg") || "#000000";
  ctx.globalAlpha = field.feedbackOpacity;
  ctx.fillRect(0,0,W,H);
  ctx.globalAlpha = 1.0;

  if(!cloudReady) return;

  // 2) Update Cube Rotation (Smooth)
  // Cursor 0..1. Center 0.5.
  const targetYaw = (field.cursorX - 0.5) * atmos.cube.rotRange * 2.0;
  const targetPitch = -(field.cursorY - 0.5) * atmos.cube.rotRange * 2.0; 

  rotY += (targetYaw - rotY) * atmos.cube.smooth;
  rotX += (targetPitch - rotX) * atmos.cube.smooth;

  const cx = proj.centerX * W;
  const cy = proj.centerY * H;

  // 3) Draw Cube
  drawWireframeCube(cx, cy, rotX, rotY);

  // 4) Draw Points (Parallax + Drift + Forces)
  const step = Math.max(1, Math.floor(cloud.length / MAX_DRAW_POINTS));
  
  const curX = field.cursorX - 0.5;
  const curY = field.cursorY - 0.5;
  
  // Pre-calc drift time
  const t = time;

  // Pre-calc Force Amplitudes
  const waveAmp  = deform.baseAmp * (0.2 + field.waveEnergy * 0.020);
  const noiseAmp = deform.baseAmp * (0.5 * field.hoverCurrent);

  // Time vars for deformation
  const tDef = time * deform.speed;

  // Cloud Rotation (Opposite to Cube)
  const cRotX = -rotX;
  const cRotY = -rotY;
  const cSX = Math.sin(cRotX), cCX = Math.cos(cRotX);
  const cSY = Math.sin(cRotY), cCY = Math.cos(cRotY);
  
  // Render loop
  for(let i=0; i<cloud.length; i+=step){
    const p = cloud[i];
    const layerId = p.layer !== undefined ? p.layer : 1;
    const L = atmos.layers[layerId];

    // Start with normalized pos
    let x = p.x;
    let y = p.y;
    let z = p.z;

    // 1. Atmospheric Drift (All points)
    x += Math.sin(t * L.driftSpeed + p.y * 4.0) * 0.015;
    y += Math.cos(t * L.driftSpeed * 0.8 + p.x * 4.0) * 0.015;

    // 2. Interaction & Rotation
    // A. Interactive Forces
    if(deform.enabled){
       // Waveform (Cursor Move)
       if(waveAmp > 0.0001){
          x += Math.sin(tDef + p.y*deform.f1 + p.z*3.0) * waveAmp;
          y += Math.sin(tDef*1.3 + p.x*deform.f2 + p.z*1.7) * waveAmp;
          z += Math.sin(tDef + p.x*deform.f3) * waveAmp * deform.zAmp;
       }
       // Noise (Hover)
       if(noiseAmp > 0.0001){
          const noiseT = time * 30.0;
          const nx = Math.sin(i * 12.9898 + noiseT);
          const ny = Math.sin(i * 78.233 + noiseT);
          const nz = Math.sin(i * 37.719 + noiseT);
          x += nx * noiseAmp;
          y += ny * noiseAmp;
          z += nz * noiseAmp;
       }
    }

    // B. 3D Rotation (Opposite)
    const r = rotate3D(x, y, z, cCX, cSX, cCY, cSY);
    x = r[0]; 
    y = r[1]; 
    z = r[2];

    // Projection
    const scale = Math.min(W,H) * 1.35; 
    const sx = cx + x * scale;
    const sy = cy + y * scale;

    let size = 1.0 * dpr * L.sizeMod;
    let alpha = L.alpha;

    // Color logic
    if(p.r !== undefined){
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
    } else {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    }
    ctx.fillRect(sx, sy, size, size);
  }
}

/* ==========================================================
   MAIN LOOP
========================================================== */

function tick(){
  // Calc wave energy from cursor movement
  const dx = field.cursorX - field.lastX;
  const dy = field.cursorY - field.lastY;
  field.waveEnergy += Math.hypot(dx, dy) * 12.0; 
  field.waveEnergy *= 0.92; // decay
  field.lastX = field.cursorX;
  field.lastY = field.cursorY;

  // Smooth hover transition
  field.hoverCurrent += (field.hoverTarget - field.hoverCurrent) * 0.08;

  // Feedback control:
  // Interaction (energy/hover) -> keep trails (low opacity clear).
  // Idle -> restore clarity (higher opacity clear).
  const isActive = field.waveEnergy > 0.05 || field.hoverCurrent > 0.05;
  const targetOp = isActive ? 0.08 : 0.22; 
  field.feedbackOpacity += (targetOp - field.feedbackOpacity) * 0.015;

  time += 0.016;

  if(field.mode === "none"){
    ctx.fillStyle = getCSS("--bg") || "#000000";
    ctx.fillRect(0,0,W,H);
    requestAnimationFrame(tick);
    return;
  }

  if(!motionOn){
    if(field.mode === "pointcloud") drawPointCloud();
    else drawNetwork();
    requestAnimationFrame(tick);
    return;
  }

  if(field.mode === "pointcloud"){
    drawPointCloud();
  } else {
    stepNetwork();
    drawNetwork();
  }

  requestAnimationFrame(tick);
}

// Start tick immediately so UI is responsive
tick();

// Then load
loadPointCloud();

/* ==========================================================
   UTILS
========================================================== */

function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getCSS(varName){
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}
