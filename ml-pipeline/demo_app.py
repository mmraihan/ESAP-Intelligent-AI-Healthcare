"""
DEMO app — full interactive differential engine prototype.
Trimmed-down version of the full product: graph + differential + explainability + next-best-test.

    python3 demo_train.py     # once, produces demo_model.pkl
    python3 demo_app.py       # open http://localhost:8000

No external dependencies — stdlib only. Co-occurrence graph loads from DB in background.
"""
import pickle, math, html, json, urllib.parse, threading, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from db import connect

PKL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_model.pkl")
if not os.path.exists(PKL):
    sys.exit("demo_model.pkl not found — run `python3 demo_train.py` first")

with open(PKL, "rb") as f:
    M = pickle.load(f)

FEAT = M["feat_names"]
FIX  = {n: i for i, n in enumerate(FEAT)}

# ── Next-best-test lookup (CCSR → recommended confirmatory tests) ─────────────
NEXT_TEST = {
    "CIR008": ["BNP / NT-proBNP", "Echocardiogram", "Chest X-ray"],
    "CIR007": ["ECG (12-lead)", "Echocardiogram", "BMP"],
    "CIR004": ["Troponin I/T (serial)", "ECG", "Coronary CTA / stress test"],
    "CIR019": ["ECG (12-lead)", "TSH", "Echocardiogram"],
    "CIR009": ["Ankle-brachial index (ABI)", "Lower extremity duplex US"],
    "CIR011": ["Holter monitor (24-48h)", "ECG", "Electrolytes"],
    "CIR001": ["Troponin I/T", "ECG", "CT pulmonary angiography"],
    "CIR003": ["Echocardiogram", "BNP", "Right heart catheterization"],
    "CIR006": ["ECG", "Echocardiogram", "BMP + Mg"],
    "END003": ["HbA1c", "Fasting plasma glucose", "BMP"],
    "END005": ["Fasting lipid panel", "LFTs", "TSH"],
    "END002": ["TSH", "Free T4", "CBC"],
    "END006": ["TSH", "Free T4 / T3", "Thyroid ultrasound"],
    "END010": ["Calcium + PTH", "Vitamin D (25-OH)", "DEXA scan"],
    "NVS010": ["BMP (Cr/BUN/eGFR)", "Urinalysis + culture", "Renal ultrasound"],
    "RSP010": ["Chest X-ray", "CBC with differential", "Sputum culture"],
    "RSP015": ["Spirometry (PFTs)", "Chest X-ray", "ABG"],
    "RSP005": ["D-dimer", "CT pulmonary angiography (CTPA)", "Lower extremity Doppler"],
    "RSP002": ["Chest X-ray", "CBC", "Sleep study (polysomnography)"],
    "RSP008": ["High-res chest CT", "PFTs", "Bronchoalveolar lavage"],
    "DIG007": ["LFTs (AST/ALT/bili)", "RUQ ultrasound", "Hepatitis B & C panel"],
    "DIG004": ["CBC (Hgb/Hct)", "Colonoscopy", "FOBT / FIT"],
    "DIG010": ["LFTs", "Abdominal ultrasound", "Upper endoscopy (EGD)"],
    "DIG009": ["Amylase + lipase", "Abdominal CT", "RFTs"],
    "BLD004": ["CBC with differential", "Iron studies (Fe/TIBC/ferritin)", "Reticulocyte count"],
    "BLD007": ["CBC", "Peripheral blood smear", "PT/INR + aPTT"],
    "BLD010": ["CBC + differential", "Flow cytometry", "Bone marrow biopsy"],
    "GEN001": ["Urinalysis + culture", "BMP", "Pelvic ultrasound (if female)"],
    "GEN003": ["PSA (male)", "Renal ultrasound", "Urodynamics"],
    "NVS011": ["Head CT (non-contrast)", "Head MRI + DWI", "Neurology consult"],
    "NVS014": ["EEG", "Head MRI", "Anti-epileptic drug levels"],
    "NVS004": ["HbA1c", "Nerve conduction study (NCS)", "Vitamin B12"],
    "NVS001": ["Head CT", "MRI brain + DWI", "Carotid ultrasound"],
    "MUS001": ["X-ray affected joint", "ESR + CRP", "Uric acid"],
    "MUS010": ["DEXA scan", "Vitamin D + calcium", "PTH"],
    "MUS007": ["ESR + CRP + RF + anti-CCP", "Joint X-rays", "Rheumatology consult"],
    "MBD005": ["TSH + free T4", "CBC + BMP", "Urine drug screen"],
    "MBD001": ["PHQ-9 screen", "TSH", "Vitamin B12 + folate"],
    "INF004": ["Blood cultures x2", "CBC with differential", "Lactate"],
    "INF002": ["HIV Ag/Ab", "CD4 count + viral load", "OI prophylaxis panel"],
    "NEO081": ["PSA (male)", "CT chest/abdomen/pelvis", "Oncology consult"],
}

# ── Co-occurrence graph — loaded in background from DB ───────────────────────
COOC = {}

def _load_cooc():
    try:
        labels = list(M["labels"])
        with connect() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT a.ccsr, b.ccsr, count(*) AS n
                FROM ml.labels a
                JOIN ml.labels b ON a.hadm_id = b.hadm_id AND a.ccsr < b.ccsr
                JOIN ml.demo_cohort dc ON dc.hadm_id = a.hadm_id
                WHERE a.ccsr = ANY(%s) AND b.ccsr = ANY(%s)
                GROUP BY 1, 2
                HAVING count(*) > 50
            """, (labels, labels))
            rows = cur.fetchall()
        mx = max((r[2] for r in rows), default=1)
        COOC.update({(r[0], r[1]): round(r[2] / mx, 3) for r in rows})
        print(f"[graph] {len(COOC)} co-occurrence edges ready", flush=True)
    except Exception as e:
        print(f"[graph] co-occurrence load failed: {e}", flush=True)

threading.Thread(target=_load_cooc, daemon=True).start()


def title_of(cc):
    t = M["titles"].get(cc, cc)
    return (t[:54] + "…") if len(t) > 55 else t


def predict(age, is_female, bmi, bp_sys, prior_codes, med_names):
    x = [0.0] * len(FEAT)
    x[FIX["age"]]       = age    if age    else M["dense_median"]["age"]
    x[FIX["is_female"]] = 1.0    if is_female else 0.0
    x[FIX["bmi"]]       = bmi    if bmi    else M["dense_median"]["bmi"]
    x[FIX["bp_sys"]]    = bp_sys if bp_sys else M["dense_median"]["bp_sys"]
    for c in prior_codes:
        if f"prior:{c}" in FIX: x[FIX[f"prior:{c}"]] = 1.0
    for d in med_names:
        if f"med:{d}"   in FIX: x[FIX[f"med:{d}"]]   = 1.0

    PRETTY = {"age": "Age", "is_female": "Female sex", "bmi": "BMI", "bp_sys": "Systolic BP"}
    ranked = []
    for cc, (coef, intercept) in M["models"].items():
        z = intercept + sum(coef[i] * x[i] for i in range(len(FEAT)))
        p = 1.0 / (1.0 + math.exp(-z))
        contribs = sorted(
            [(coef[i] * x[i],
              ("Prior: " + title_of(nm[6:]) if nm.startswith("prior:") else
               "Med: " + nm[4:]             if nm.startswith("med:")   else
               PRETTY.get(nm, nm)))
             for i, nm in enumerate(FEAT) if x[i] != 0 and coef[i] > 0],
            reverse=True)
        ranked.append({
            "cc":    cc,
            "prob":  round(p, 4),
            "title": title_of(cc),
            "why":   [c[1] for c in contribs[:3]],
            "tests": NEXT_TEST.get(cc, ["Basic metabolic panel (BMP)", "CBC with differential"]),
        })
    ranked.sort(key=lambda r: -r["prob"])

    top10    = ranked[:10]
    top_ids  = {r["cc"] for r in top10}
    nodes    = [{"id": r["cc"], "label": r["title"], "prob": r["prob"], "rank": i + 1}
                for i, r in enumerate(top10)]
    edges    = [{"s": a, "t": b, "w": w}
                for (a, b), w in COOC.items() if a in top_ids and b in top_ids]
    return ranked, nodes, edges


def _safe_json(obj):
    return json.dumps(obj).replace("</", "<\\/")


# ── Pre-build option HTML once at startup ─────────────────────────────────────
PRIOR_OPTS = "".join(
    f'<option value="{html.escape(c)}">{html.escape(title_of(c))}</option>'
    for c in M["pdx_vocab"])
MED_OPTS = "".join(
    f'<option value="{html.escape(d)}">{html.escape(d)}</option>'
    for d in M["med_vocab"])


# ── HTML template ─────────────────────────────────────────────────────────────
HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Differential Engine</title>
<style>
:root{
  --bg:#0B1E22;--card:#112830;--card2:#0D2228;
  --line:rgba(84,214,198,.14);--line2:rgba(84,214,198,.07);
  --text:#E7F1EE;--muted:#8FB1AD;--dim:#4A726E;
  --cyan:#54D6C6;--amber:#F2B570;--green:#6FCFA8;--red:#E07878;
  --mono:ui-monospace,Menlo,'Cascadia Code',monospace
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;min-height:100vh}
.wrap{max-width:1160px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);padding:18px 0 14px}
.hdr-tag{font-family:var(--mono);font-size:.65rem;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan);margin-bottom:3px}
.hdr-h1{font-family:var(--mono);font-size:1.5rem;font-weight:700;letter-spacing:-.02em;margin-bottom:3px}
.hdr-sub{color:var(--muted);font-size:.88rem}
.layout{display:grid;grid-template-columns:290px 1fr;gap:18px;padding:18px 0 60px;align-items:start}
@media(max-width:720px){.layout{grid-template-columns:1fr}}
.form-col{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:13px;position:sticky;top:16px}
.slbl{font-family:var(--mono);font-size:.63rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;display:flex;align-items:center;justify-content:space-between}
.slbl .hint{font-size:.58rem;color:var(--dim);text-transform:none;letter-spacing:0;font-family:inherit}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
label{display:block;font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:3px}
input,select{width:100%;background:#081920;border:1px solid var(--line);color:var(--text);border-radius:7px;padding:7px 9px;font-size:.88rem;font-family:inherit;outline:none;transition:border-color .15s}
input:focus,select:focus{border-color:var(--cyan)}
select[multiple]{height:120px;padding:3px}
.btn{font-family:var(--mono);background:var(--amber);color:#0B1E22;border:0;border-radius:8px;padding:11px;font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;font-weight:700;width:100%;transition:opacity .15s}
.btn:hover{opacity:.85}
.comp{display:flex;flex-wrap:wrap;gap:4px;min-height:20px}
.chip{font-family:var(--mono);font-size:.6rem;padding:2px 6px;border-radius:4px;border:1px solid}
.chip.ok{color:var(--green);border-color:rgba(111,207,168,.28);background:rgba(111,207,168,.05)}
.chip.miss{color:var(--dim);border-color:rgba(74,114,110,.2);background:transparent}
.results-col{display:flex;flex-direction:column;gap:13px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.phdr{display:flex;justify-content:space-between;align-items:center;padding:11px 15px;border-bottom:1px solid var(--line2)}
.ptitle{font-family:var(--mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan)}
.pmeta{font-family:var(--mono);font-size:.62rem;color:var(--dim)}
#graph-svg{display:block;width:100%}
.gempty{padding:44px 20px;text-align:center;color:var(--dim);font-size:.85rem;font-family:var(--mono)}
#dcards{padding:11px;display:flex;flex-direction:column;gap:7px}
.dempty{padding:36px 20px;text-align:center;color:var(--dim);font-size:.85rem;font-family:var(--mono)}
.dc{background:var(--card2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px}
.dc-top{display:flex;align-items:baseline;gap:7px;margin-bottom:5px}
.dc-rank{font-family:var(--mono);font-size:.65rem;color:var(--dim);min-width:22px}
.dc-name{font-weight:600;font-size:.93rem;flex:1;line-height:1.3}
.dc-prob{font-family:var(--mono);color:var(--amber);font-size:.98rem;font-weight:700}
.dc-bar{height:3px;background:#081920;border-radius:2px;margin-bottom:7px;overflow:hidden}
.dc-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--amber));border-radius:2px}
.dc-why{font-size:.78rem;color:var(--muted);margin-bottom:5px}
.dc-why b{color:var(--cyan);font-weight:500}
.dc-tests{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.tc{font-family:var(--mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.tk{font-size:.72rem;color:var(--amber);background:rgba(242,181,112,.07);border:1px solid rgba(242,181,112,.18);border-radius:4px;padding:2px 7px}
.foot{font-size:.72rem;color:var(--dim);font-family:var(--mono);padding:6px 0 2px}
.foot strong{color:var(--red)}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="hdr-tag">MIMIC-IV &middot; concurrent comorbidity inference &middot; prototype</div>
    <h1 class="hdr-h1">Differential Engine</h1>
    <p class="hdr-sub">Enter what you know about the patient &mdash; works with any subset of data, sharpens as more arrives.</p>
  </div>
</header>
<main class="wrap">
<div class="layout">
  <aside class="form-col">
    <form id="frm" method="post" action="/predict">
      <div>
        <div class="slbl">Vitals &amp; Demographics</div>
        <div class="g2">
          <div><label>Age</label><input id="fa" name="age" type="number" min="18" max="105"></div>
          <div><label>Sex</label>
            <select id="fs" name="sex">
              <option value="">&#8212;</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
          <div><label>BMI</label><input id="fb" name="bmi" type="number" step="0.1"></div>
          <div><label>Systolic BP</label><input id="fp" name="bp_sys" type="number"></div>
        </div>
      </div>
      <div>
        <div class="slbl">Prior Conditions <span class="hint">ctrl / &#8984; for multiple</span></div>
        <select id="fpr" name="prior" multiple>PRIOR_OPTS_PLACEHOLDER</select>
      </div>
      <div>
        <div class="slbl">Home Medications <span class="hint">ctrl / &#8984; for multiple</span></div>
        <select id="fme" name="meds" multiple>MED_OPTS_PLACEHOLDER</select>
      </div>
      <div id="comp" class="comp"></div>
      <button class="btn" type="submit">Compute Differential &rarr;</button>
    </form>
  </aside>

  <section class="results-col">
    <div class="panel">
      <div class="phdr">
        <span class="ptitle">Condition Graph</span>
        <span class="pmeta" id="gmeta">co-occurrence loads after first prediction</span>
      </div>
      <svg id="graph-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="gempty" class="gempty">Submit patient data to see the predicted condition network</div>
    </div>
    <div class="panel">
      <div class="phdr">
        <span class="ptitle">Ranked Differential</span>
        <span class="pmeta" id="dmeta"></span>
      </div>
      <div id="dcards"></div>
      <div id="dempty" class="dempty">Predicted conditions appear here</div>
    </div>
    <p class="foot" id="foot"></p>
  </section>
</div>
</main>
<script>
var D=PAGE_DATA_PLACEHOLDER;

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// Restore form on POST roundtrip
if(D&&D.form){
  var f=D.form;
  if(f.age) document.getElementById('fa').value=f.age;
  if(f.sex) document.getElementById('fs').value=f.sex;
  if(f.bmi) document.getElementById('fb').value=f.bmi;
  if(f.bp)  document.getElementById('fp').value=f.bp;
  function markSel(id,vals){
    if(!vals||!vals.length)return;
    var s=new Set(vals),el=document.getElementById(id);
    for(var i=0;i<el.options.length;i++)el.options[i].selected=s.has(el.options[i].value);
  }
  markSel('fpr',f.prior);markSel('fme',f.meds);
}

// Completeness chips
function updComp(){
  var items=[
    {l:'Age',   ok:!!document.getElementById('fa').value},
    {l:'Sex',   ok:!!document.getElementById('fs').value},
    {l:'BMI',   ok:!!document.getElementById('fb').value},
    {l:'BP',    ok:!!document.getElementById('fp').value},
    {l:Array.from(document.getElementById('fpr').selectedOptions).length+' prior dx',
     ok:Array.from(document.getElementById('fpr').selectedOptions).length>0},
    {l:Array.from(document.getElementById('fme').selectedOptions).length+' meds',
     ok:Array.from(document.getElementById('fme').selectedOptions).length>0}
  ];
  document.getElementById('comp').innerHTML=items.map(function(i){
    return'<span class="chip '+(i.ok?'ok':'miss')+'">'+i.l+'</span>';
  }).join('');
}
['fa','fs','fb','fp'].forEach(function(id){document.getElementById(id).addEventListener('input',updComp);});
['fpr','fme'].forEach(function(id){document.getElementById(id).addEventListener('change',updComp);});
updComp();

// Footnote
if(D){
  document.getElementById('foot').innerHTML=
    'demo model &middot; '+D.nlabels+' conditions &middot; val Recall@20 '+D.r20+
    ' &middot; 100k-admission sample &middot; tabular features only (notes + labs in Phase 1)'+
    ' &middot; <strong>NOT FOR CLINICAL USE</strong>';
}

// Differential cards
function renderCards(ranked){
  var el=document.getElementById('dcards'),em=document.getElementById('dempty');
  if(!ranked||!ranked.length){el.innerHTML='';em.style.display='';return;}
  em.style.display='none';
  document.getElementById('dmeta').textContent=
    'top '+Math.min(ranked.length,10)+' of '+ranked.length+' conditions';
  el.innerHTML=ranked.slice(0,10).map(function(r,i){
    var pct=Math.round(r.prob*100);
    var why=r.why&&r.why.length
      ?r.why.map(function(w){return'<b>'+esc(w)+'</b>';}).join(' &middot; ')
      :'baseline prevalence';
    var tests=r.tests.slice(0,3).map(function(t){return'<span class="tk">'+esc(t)+'</span>';}).join('');
    return'<div class="dc">'+
      '<div class="dc-top">'+
        '<span class="dc-rank">#'+(i+1)+'</span>'+
        '<span class="dc-name">'+esc(r.title)+'</span>'+
        '<span class="dc-prob">'+pct+'%</span>'+
      '</div>'+
      '<div class="dc-bar"><i style="width:'+Math.min(pct,100)+'%"></i></div>'+
      '<div class="dc-why">why: '+why+'</div>'+
      '<div class="dc-tests"><span class="tc">next test:</span> '+tests+'</div>'+
      '</div>';
  }).join('');
}

// Force-directed graph
function runGraph(nodes,edges){
  var svg=document.getElementById('graph-svg');
  var em=document.getElementById('gempty');
  if(!nodes||!nodes.length){em.style.display='';svg.style.display='none';return;}
  em.style.display='none';svg.style.display='block';
  var W=svg.parentElement.clientWidth||640,H=290;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.style.height=H+'px';
  var cx=W/2,cy=H/2,NS='http://www.w3.org/2000/svg';
  function ce(t){return document.createElementNS(NS,t);}
  function sa(el,a){for(var k in a)el.setAttribute(k,a[k]);return el;}

  var ns=nodes.map(function(n,i){
    var a=(2*Math.PI*i/nodes.length)-Math.PI/2;
    return{id:n.id,label:n.label,prob:n.prob,rank:n.rank,
      x:cx+Math.cos(a)*115,y:cy+Math.sin(a)*88,vx:0,vy:0};
  });
  var byId={};ns.forEach(function(n){byId[n.id]=n;});

  function tick(){
    for(var i=0;i<ns.length;i++){
      for(var j=i+1;j<ns.length;j++){
        var dx=ns[j].x-ns[i].x,dy=ns[j].y-ns[i].y,d2=dx*dx+dy*dy+1,f=7000/d2;
        ns[i].vx-=f*dx;ns[i].vy-=f*dy;ns[j].vx+=f*dx;ns[j].vy+=f*dy;
      }
    }
    edges.forEach(function(e){
      var a=byId[e.s],b=byId[e.t];if(!a||!b)return;
      var dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      var rest=95-e.w*38,f=(d-rest)*0.055;
      a.vx+=f*dx/d;a.vy+=f*dy/d;b.vx-=f*dx/d;b.vy-=f*dy/d;
    });
    ns.forEach(function(n){
      n.vx+=(cx-n.x)*0.012;n.vy+=(cy-n.y)*0.012;
      n.vx*=0.78;n.vy*=0.78;
      n.x=Math.max(40,Math.min(W-40,n.x+n.vx));
      n.y=Math.max(28,Math.min(H-32,n.y+n.vy));
    });
  }

  function draw(){
    svg.innerHTML='';
    edges.forEach(function(e){
      var a=byId[e.s],b=byId[e.t];if(!a||!b)return;
      svg.appendChild(sa(ce('line'),{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
        stroke:'rgba(84,214,198,'+(0.1+e.w*0.38)+')',
        'stroke-width':0.8+e.w*2.4}));
    });
    ns.forEach(function(n){
      var top=n.rank===1,r=12+n.prob*18,col=top?'#F2B570':'#54D6C6';
      var g=ce('g');
      g.appendChild(sa(ce('circle'),{cx:n.x,cy:n.y,r:r+10,fill:col,'fill-opacity':0.04}));
      g.appendChild(sa(ce('circle'),{cx:n.x,cy:n.y,r:r,fill:col,
        'fill-opacity':top?0.22:0.12,stroke:col,'stroke-width':top?2:1.5}));
      var rt=sa(ce('text'),{x:n.x,y:n.y+4,'text-anchor':'middle',
        'font-family':'ui-monospace,monospace','font-size':'11','font-weight':'bold',fill:col});
      rt.textContent='#'+n.rank;g.appendChild(rt);
      var short=n.label.length>22?n.label.slice(0,20)+'…':n.label;
      var lt=sa(ce('text'),{x:n.x,y:n.y+r+13,'text-anchor':'middle','font-size':'9.5',fill:'#8FB1AD'});
      lt.textContent=short;g.appendChild(lt);
      var pt=sa(ce('text'),{x:n.x,y:n.y+r+24,'text-anchor':'middle','font-size':'8.5',
        fill:'#4A726E','font-family':'ui-monospace,monospace'});
      pt.textContent=Math.round(n.prob*100)+'%';g.appendChild(pt);
      svg.appendChild(g);
    });
  }

  var frame=0;
  function loop(){tick();draw();frame++;if(frame<200)requestAnimationFrame(loop);}
  requestAnimationFrame(loop);
}

// Init with server data
if(D&&D.ranked){
  document.getElementById('gmeta').textContent=D.edges.length+' co-occurrence edges';
  renderCards(D.ranked);
  runGraph(D.nodes,D.edges);
}
</script>
</body>
</html>"""

BASE_HTML = (HTML
    .replace("PRIOR_OPTS_PLACEHOLDER", PRIOR_OPTS)
    .replace("MED_OPTS_PLACEHOLDER",   MED_OPTS))


class H(BaseHTTPRequestHandler):
    def _send(self, body):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def _render(self, page_data):
        self._send(BASE_HTML.replace("PAGE_DATA_PLACEHOLDER", _safe_json(page_data)))

    def _base_data(self):
        return {"nlabels": len(M["labels"]), "r20": M["metrics"]["recall@20"],
                "ranked": None, "nodes": None, "edges": None, "form": None}

    def do_GET(self):
        self._render(self._base_data())

    def do_POST(self):
        n   = int(self.headers.get("Content-Length", 0))
        frm = urllib.parse.parse_qs(self.rfile.read(n).decode("utf-8"))
        g   = lambda k: frm.get(k, [""])[0]
        num = lambda k: float(g(k)) if g(k) else None
        prior = frm.get("prior", [])
        meds  = frm.get("meds",  [])
        ranked, nodes, edges = predict(
            num("age"), g("sex") == "F", num("bmi"), num("bp_sys"), prior, meds)
        data = self._base_data()
        data.update({
            "ranked": ranked[:12], "nodes": nodes, "edges": edges,
            "form": {"age": g("age"), "sex": g("sex"), "bmi": g("bmi"), "bp": g("bp_sys"),
                     "prior": prior, "meds": meds}
        })
        self._render(data)

    def log_message(self, *a): pass


if __name__ == "__main__":
    print("Differential Engine demo  ->  http://localhost:8000  (Ctrl-C to stop)")
    HTTPServer(("127.0.0.1", 8000), H).serve_forever()
