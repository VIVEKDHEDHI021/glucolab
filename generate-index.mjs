import fs from "fs";
import path from "path";

const clientDistDir = path.resolve("dist/client");
const assetsDir = path.join(clientDistDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("Assets directory not found");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);

// 1. Find all CSS files emitted by Vite
const cssFiles = files.filter(f => f.endsWith(".css"));
const cssLinks = cssFiles.map(f => `<link rel="stylesheet" href="/assets/${f}" />`).join("\n    ");

// 2. Find the largest index-*.js file which represents our main React/router bundle
let jsEntry = "";
let maxJsSize = 0;

for (const file of files) {
  if (file.endsWith(".js") && file.startsWith("index-")) {
    const filePath = path.join(assetsDir, file);
    const stats = fs.statSync(filePath);
    if (stats.size > maxJsSize) {
      maxJsSize = stats.size;
      jsEntry = `assets/${file}`;
    }
  }
}

// Fallback if no index-*.js matches
if (!jsEntry) {
  const anyIndex = files.find(f => f.endsWith(".js") && f.startsWith("index"));
  if (anyIndex) jsEntry = `assets/${anyIndex}`;
}

console.log("Using JS entry:", jsEntry);
console.log("Using CSS files:", cssFiles);

// Inlined critical splash styles to guarantee immediate 0ms rendering with ZERO FOUC / black screens / flickers
const criticalSplashCss = `
  html {
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .splash-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background-color: #ffffff !important;
    color: #111827 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1 !important;
    z-index: 999999;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    pointer-events: auto;
    animation: splashExit 0.40s ease-in-out 3.50s forwards;
  }

  .splash-screen.splash-finished {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
    opacity: 0 !important;
  }

  .logo-wrapper {
    display: flex;
    align-items: baseline;
    font-size: clamp(2.4rem, 9vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #111827;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    animation: logoSettle 0.60s cubic-bezier(0.22, 1, 0.36, 1) 2.50s forwards;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform: translateZ(0);
  }

  .word {
    display: inline-flex;
  }

  .gluco span {
    display: inline-block;
    opacity: 0;
    transform: translateY(24px);
    animation: glucoReveal 0.50s cubic-bezier(0.22, 1.05, 0.36, 1) forwards;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }
  .gluco span:nth-child(1) { animation-delay: 0.30s; }
  .gluco span:nth-child(2) { animation-delay: 0.44s; }
  .gluco span:nth-child(3) { animation-delay: 0.58s; }
  .gluco span:nth-child(4) { animation-delay: 0.72s; }
  .gluco span:nth-child(5) { animation-delay: 0.86s; }

  .red-plus {
    display: inline-block;
    color: #e11d48;
    margin: 0 0.18rem;
    font-weight: 900;
    opacity: 0;
    transform: scale(0.75);
    animation: plusPulse 0.55s cubic-bezier(0.25, 1, 0.5, 1) 1.30s forwards;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }

  .lab span {
    display: inline-block;
    font-weight: 600;
    color: #374151;
    opacity: 0;
    transform: translate(20px, 6px);
    animation: labSlide 0.45s cubic-bezier(0.22, 1.04, 0.36, 1) forwards;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }
  .lab span:nth-child(1) { animation-delay: 1.70s; }
  .lab span:nth-child(2) { animation-delay: 1.86s; }
  .lab span:nth-child(3) { animation-delay: 2.02s; }

  @keyframes glucoReveal {
    0%   { opacity: 0; transform: translateY(24px); }
    85%  { opacity: 1; transform: translateY(-1.5px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes plusPulse {
    0%   { opacity: 0; transform: scale(0.75); }
    60%  { opacity: 1; transform: scale(1.15); }
    100% { opacity: 1; transform: scale(1.00); }
  }

  @keyframes labSlide {
    0%   { opacity: 0; transform: translate(20px, 6px); }
    85%  { opacity: 1; transform: translate(-0.5px, -0.5px); }
    100% { opacity: 1; transform: translate(0, 0); }
  }

  @keyframes logoSettle {
    0%   { transform: scale(1.004); }
    100% { transform: scale(1.000); }
  }

  @keyframes splashExit {
    from { opacity: 1; transform: scale(1); visibility: visible; }
    to   { opacity: 0; transform: scale(1.03); visibility: hidden; }
  }

  @media (prefers-reduced-motion: reduce) {
    .splash-screen {
      animation-duration: 0.01s !important;
    }
    .gluco span, .red-plus, .lab span, .logo-wrapper {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }
`;

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="icon" type="image/png" href="/icon/icon.png" />
    <title>GlucoLab</title>
    <style>${criticalSplashCss}</style>
    ${cssLinks}
    <script src="capacitor.js"></script>
    <script>
      window.addEventListener("error", function(event) {
        console.error("HTML GLOBAL ERROR:", event.message, event.error ? event.error.stack : "");
      });
      window.addEventListener("unhandledrejection", function(event) {
        console.error("HTML UNHANDLED REJECTION:", event.reason ? event.reason.message : event.reason, event.reason ? event.reason.stack : "");
      });
    </script>
  </head>
  <body>
    <!-- Immediate static startup splash screen: zero delay, zero black frame, zero unstyled text -->
    <div id="startup-splash" class="splash-screen">
      <div class="logo-wrapper">
        <div class="word gluco">
          <span>G</span><span>L</span><span>U</span><span>C</span><span>O</span>
        </div>
        <span class="red-plus">+</span>
        <div class="word lab">
          <span>L</span><span>A</span><span>B</span>
        </div>
      </div>
    </div>
    <div id="root"></div>
    <!-- Tanstack Router uses the body directly or hydrates -->
    ${jsEntry ? `<script type="module" src="/${jsEntry}"></script>` : ""}
  </body>
</html>`;

fs.writeFileSync(path.join(clientDistDir, "index.html"), html);
console.log("Generated dist/client/index.html with critical inline splash");
