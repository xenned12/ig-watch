---
id: pattern-004
category: auth
language: unknown
score: 50
tags: [auth, next-auth]
---

## 컨텍스트
파일: reel-intel-prototype.html (Write 완료)

## 핵심 코드
```unknown
<title>Reel Intel Prototype</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Fira+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: app shell — sidebar + scrolling work area; modals for transcripts and scripts. Blue = competitors / primary, amber = client. */
:root{
  --bg:#F5F7FB;--surface:#FFFFFF;--sunk:#EBEFF6;--fg:#0F1B3D;--muted:#52607A;--line:#DCE3EE;--line-strong:#C3CDDD;
  --primary:#1E40AF;--primary-hover:#1A378F;--primary-soft:#DFE8FB;--on-primary:#FFFFFF;
  --client:#B45309;--client-soft:#FDF0D5;
  --ok:#15803D;--ok-soft:#DCF3E4;--bad:#B91C1C;--bad-soft:#FBE3E3;
  --scrim:rgba(15,27,61,.5);
  --f-sans:'Fira Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  --f-mono:'Fira Code',ui-monospace,'SFMono-Regular',Menlo,monospace;
  --r:8px;--r-lg:12px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0B1120;--surface:#131B2E;--sunk:#0E1526;--fg:#E6ECF7;--muted:#9AA8C2;--line:#233050;--line-strong:#33446A;
  --primary:#8DB4FF;--primary-hover:#A9C6FF;--primary-soft:#1B2C55;--on-primary:#0B1120;
  --client:#F5B94A;--client-soft:#3D2A0C;--ok:#5FD08A;--ok-soft:#123222;--bad:#F28B8B;--bad-soft:#3A1616;--scrim:rgba(0,0,0,.6);color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0B1120;--surface:#131B2E;--sunk:#0E1526;--fg:#E6ECF7;--muted:#9AA8C2;--line:#233050;--line-strong:#33446A;
  --primary:#8DB4FF;--primary-hover:#A9C6FF;--primary-soft:#1B2C55;--on-primary:#0B1120;
  --client:#F5B94A;--client-soft:#3D2A0C;--ok:#5FD08A;--ok-soft:#123222;--bad:#F28B8B;--bad-soft:#3A1616;--scrim:rgba(0,0,0,.6);color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--f-sans);font-size:15px;line-height:1.5}
.mono,.num{font-family:var(--f-mono);font-variant-numeric:tabular-nums}
h1,h2,h3{margin:0;text-wrap:balance;font-weight:600}
h1{font-size:22px}h2{font-size:17px}h3{font-size:15px}
p{margin:0}
a{color:var(--primary)}
button,input,select{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.muted{color:var(--muted)}.small{font-size:13px}.xs{font-size:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 14px;border-radius:var(--r);border:1px solid var(--line-strong);background:var(--surface);cursor:pointer;transition:background .15s,border-color .15s;text-decoration:none;color:var(--fg)}
.btn:hover{border-color:var(--primary)}
.btn.primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.btn.primary:hover{background:var(--primary-hover)}
.btn.ghost{border-color:transparent;background:transparent}
.btn.ghost:hover{background:var(--sunk)}
.btn.sm{min-height:32px;padding:0 10px;font-size:13px}
.btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed}
.linkbtn{background:none;border:0;padding:0;color:var(--primary);cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-size:13px;text-align:left}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:16px 18px}
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:13px;font-weight:500}
.input{min-height:42px;padding:0 12px;border-radius:var(--r);border:1px solid var(--line-strong);background:var(--surface);width:100%}
.input[aria-invalid="true"]{border-color:var(--bad)}
.err{color:var(--bad);font-size:13px;display:flex;gap:6px;align-items:center}
.help{color:var(--muted);font-size:13px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:3px 9px;border-radius:999px;white-space:nowrap;font-weight:500}
```

## 태그
- auth
- next-auth