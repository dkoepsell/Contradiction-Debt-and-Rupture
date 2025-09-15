import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

// --- Helpers ---
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0); }

// --- Types ---
interface Triple {
  scope: number; severity: number; salience: number;
}
interface ViolationDomains {
  security: Triple;
  ruleOfLaw: Triple;
  centerLocal: Triple;
  narrativeGap: Triple;
  humanitarian: Triple;
}
interface RepairDims {
  ack: number; reform: number; comp: number; inclusive: number; fidelity: number;
}
interface Health {
  L: number; E: number; K: number; C: number; B: number; T: number; P: number;
}
interface PeriodInput {
  baselineD: number; // D(t-1)
  violations: ViolationDomains;
  repair: RepairDims;
  health: Health;
}
interface Scenario {
  id: string;
  name: string;
  note?: string;
  period: PeriodInput;
  eventDate?: string; // YYYY-MM-DD
  cdFlagDate?: string; // first CD rupture window flag
  altModelName?: string;
  altFlagDate?: string; // comparison model flag
}

const DEFAULT_TRIPLE: Triple = { scope: 0.5, severity: 0.5, salience: 0.5 };
const DEFAULT_VIOL: ViolationDomains = {
  security: { ...DEFAULT_TRIPLE },
  ruleOfLaw: { ...DEFAULT_TRIPLE },
  centerLocal: { ...DEFAULT_TRIPLE },
  narrativeGap: { ...DEFAULT_TRIPLE },
  humanitarian: { ...DEFAULT_TRIPLE },
};
const DEFAULT_REPAIR: RepairDims = { ack: 0.4, reform: 0.4, comp: 0.4, inclusive: 0.4, fidelity: 0.4 };
const DEFAULT_HEALTH: Health = { L: 0.6, E: 0.6, K: 0.6, C: 0.2, B: 0.3, T: 0.6, P: 0.3 };

// Seed scenarios (illustrative only)
const SEED: Scenario[] = [
  {
    id: "haiti",
    name: "Haiti (Q3 2025)",
    note: "Illustrative values based on public reporting; adjust as needed.",
    period: {
      baselineD: 2.5,
      violations: {
        security: { scope: 0.9, severity: 0.9, salience: 0.9 },
        ruleOfLaw: { scope: 0.8, severity: 0.7, salience: 0.7 },
        centerLocal: { scope: 0.8, severity: 0.6, salience: 0.6 },
        narrativeGap: { scope: 0.7, severity: 0.6, salience: 0.6 },
        humanitarian: { scope: 0.9, severity: 0.8, salience: 0.8 },
      },
      repair: { ack: 0.7, reform: 0.4, comp: 0.5, inclusive: 0.5, fidelity: 0.3 },
      health: { L: 0.4, E: 0.45, K: 0.3, C: 0.4, B: 0.55, T: 0.3, P: 0.6 },
    },
    eventDate: "2026-01-15",
    cdFlagDate: "2025-07-15",
    altModelName: "FSI/PITF (illustrative)",
    altFlagDate: "2025-11-01",
  },
  {
    id: "sudan",
    name: "Sudan (Q3 2025)",
    period: {
      baselineD: 3.0,
      violations: {
        security: { scope: 0.95, severity: 0.9, salience: 0.9 },
        ruleOfLaw: { scope: 0.85, severity: 0.85, salience: 0.8 },
        centerLocal: { scope: 0.8, severity: 0.7, salience: 0.7 },
        narrativeGap: { scope: 0.7, severity: 0.6, salience: 0.7 },
        humanitarian: { scope: 0.9, severity: 0.85, salience: 0.8 },
      },
      repair: { ack: 0.5, reform: 0.3, comp: 0.3, inclusive: 0.3, fidelity: 0.2 },
      health: { L: 0.35, E: 0.3, K: 0.3, C: 0.4, B: 0.6, T: 0.25, P: 0.7 },
    },
  },
  {
    id: "ecuador",
    name: "Ecuador (Q3 2025)",
    period: {
      baselineD: 1.2,
      violations: {
        security: { scope: 0.6, severity: 0.6, salience: 0.7 },
        ruleOfLaw: { scope: 0.5, severity: 0.5, salience: 0.5 },
        centerLocal: { scope: 0.5, severity: 0.4, salience: 0.4 },
        narrativeGap: { scope: 0.4, severity: 0.4, salience: 0.4 },
        humanitarian: { scope: 0.4, severity: 0.4, salience: 0.4 },
      },
      repair: { ack: 0.6, reform: 0.6, comp: 0.6, inclusive: 0.6, fidelity: 0.6 },
      health: { L: 0.6, E: 0.7, K: 0.6, C: 0.25, B: 0.4, T: 0.55, P: 0.45 },
    },
  },
];

// --- Calculations ---
function tripleScore(t: Triple) {
  return clamp01(t.scope) * clamp01(t.severity) * clamp01(t.salience);
}
function V_total(v: ViolationDomains) {
  const raw = sum([
    tripleScore(v.security),
    tripleScore(v.ruleOfLaw),
    tripleScore(v.centerLocal),
    tripleScore(v.narrativeGap),
    tripleScore(v.humanitarian),
  ]);
  return Math.min(2, raw); // cap at 2 for comparability
}
function repairAvg(r: RepairDims) {
  return (r.ack + r.reform + r.comp + r.inclusive + r.fidelity) / 5;
}
function capacityFactor(h: Health) {
  return (h.L + h.E + h.K) / 3;
}
function R_total(r: RepairDims, h: Health) {
  return repairAvg(r) * capacityFactor(h);
}

function tippingFlags(h: Health, R: number, V: number) {
  const flags = {
    L: h.L < 0.45,
    E: h.E < 0.60,
    B: h.B > 0.5,
    C: h.C > 0.35,
    Rv: V > 0 ? R / V < 0.5 : false,
  };
  const count = Object.values(flags).filter(Boolean).length;
  return { flags, count, inWindow: count >= 2 };
}

// small slider component
const RowSlider: React.FC<{label:string,value:number,onChange:(v:number)=>void,step?:number}> = ({label,value,onChange,step=0.01}) => (
  <div className="flex items-center gap-4">
    <Label className="w-40 text-sm text-muted-foreground">{label}</Label>
    <Slider value={[value]} min={0} max={1} step={step} onValueChange={(arr)=>onChange(arr[0])} className="w-64" />
    <Input className="w-20" type="number" step={step} min={0} max={1} value={round2(value)} onChange={e=>onChange(clamp01(parseFloat(e.target.value)||0))} />
  </div>
);

const TripleEditor: React.FC<{title:string,t:Triple,onChange:(t:Triple)=>void}> = ({title,t,onChange}) => (
  <Card className="border rounded-2xl shadow-sm">
    <CardContent className="p-4 space-y-3">
      <div className="text-sm font-semibold text-muted-foreground">{title}</div>
      <RowSlider label="Scope" value={t.scope} onChange={(v)=>onChange({...t, scope:v})} />
      <RowSlider label="Severity" value={t.severity} onChange={(v)=>onChange({...t, severity:v})} />
      <RowSlider label="Salience" value={t.salience} onChange={(v)=>onChange({...t, salience:v})} />
      <div className="text-xs text-muted-foreground">Score: {round2(tripleScore(t))}</div>
    </CardContent>
  </Card>
);

export default function CDPlayground(){
  const [scenarios, setScenarios] = useState<Scenario[]>(SEED);
  const [activeId, setActiveId] = useState<string>(SEED[0].id);
  const active = scenarios.find(s=>s.id===activeId)!;

  const V = useMemo(()=>V_total(active.period.violations),[active]);
  const Ravg = useMemo(()=>repairAvg(active.period.repair),[active]);
  const cap = useMemo(()=>capacityFactor(active.period.health),[active]);
  const R = useMemo(()=>R_total(active.period.repair, active.period.health),[active]);
  const D = useMemo(()=>active.period.baselineD + V - R,[active, V, R]);
  const rv = useMemo(()=> V>0 ? R/V : 0,[R,V]);
  const tf = useMemo(()=>tippingFlags(active.period.health, R, V),[active, R, V]);

  // Simple N-period projection with constant parameters
  const [horizon, setHorizon] = useState(8);
  const simData = useMemo(()=>{
    const data:any[] = [];
    let d = active.period.baselineD;
    for(let t=1;t<=horizon;t++){
      d = d + V - R;
      data.push({ period: t, D: round2(d), V: round2(V), R: round2(R), RdivV: round2(rv) });
    }
    return data;
  },[active, V, R, rv, horizon]);

  const updateActive = (mut: (s:Scenario)=>Scenario) => {
    setScenarios(prev => prev.map(s => s.id===activeId ? mut({...s}) : s));
  };

  const addScenario = () => {
    const id = `case_${Date.now()}`;
    const s: Scenario = { id, name: "New Case", period: { baselineD: 1.5, violations: { ...DEFAULT_VIOL }, repair: { ...DEFAULT_REPAIR }, health: { ...DEFAULT_HEALTH } } };
    setScenarios(prev => [...prev, s]);
    setActiveId(id);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cd_playground_scenarios.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const arr = JSON.parse(String(reader.result));
        if(Array.isArray(arr)) setScenarios(arr);
      }catch(e){ alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">GoG Contradiction Debt Playground</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addScenario}>+ New Case</Button>
          <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
          <label className="text-sm px-3 py-2 rounded-lg border cursor-pointer hover:bg-accent">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={e=>{ if(e.target.files?.[0]) importJSON(e.target.files[0]); }} />
          </label>
        </div>
      </div>

      <Tabs defaultValue="model" className="w-full">
        <TabsList>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="compare">Compare Models</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="model">
          <div className="grid grid-cols-12 gap-5">
            {/* Sidebar: scenario list */}
            <div className="col-span-3 space-y-3">
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Scenarios</div>
                  <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                    {scenarios.map(s=> (
                      <Button key={s.id} variant={s.id===activeId?"default":"outline"} className="w-full justify-start" onClick={()=>setActiveId(s.id)}>
                        {s.name}
                      </Button>
                    ))}
                  </div>
                  <Label className="text-xs text-muted-foreground">Case name</Label>
                  <Input value={active.name} onChange={e=>updateActive(s=>({ ...s, name:e.target.value }))} />
                  <Label className="text-xs text-muted-foreground">Case note</Label>
                  <Textarea value={active.note||""} onChange={e=>updateActive(s=>({ ...s, note:e.target.value }))} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Health (0–1)</div>
                  <RowSlider label="Legitimacy (L)" value={active.period.health.L} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, L:v}}}))} />
                  <RowSlider label="Elite cohesion (E)" value={active.period.health.E} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, E:v}}}))} />
                  <RowSlider label="Capacity (K)" value={active.period.health.K} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, K:v}}}))} />
                  <RowSlider label="Cost strain (C)" value={active.period.health.C} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, C:v}}}))} />
                  <RowSlider label="Backfire (B)" value={active.period.health.B} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, B:v}}}))} />
                  <RowSlider label="Trust (T)" value={active.period.health.T} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, T:v}}}))} />
                  <RowSlider label="Protest (P)" value={active.period.health.P} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, health:{...s.period.health, P:v}}}))} />
                </CardContent>
              </Card>
            </div>

            {/* Main column */}
            <div className="col-span-9 space-y-5">
              <div className="grid grid-cols-12 gap-5">
                <Card className="col-span-5 rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-semibold mb-1">Violations (V)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <TripleEditor title="Security / rights" t={active.period.violations.security} onChange={(t)=>updateActive(s=>({ ...s, period:{...s.period, violations:{...s.period.violations, security:t}}}))} />
                      <TripleEditor title="Rule of law / elections" t={active.period.violations.ruleOfLaw} onChange={(t)=>updateActive(s=>({ ...s, period:{...s.period, violations:{...s.period.violations, ruleOfLaw:t}}}))} />
                      <TripleEditor title="Center–local contradictions" t={active.period.violations.centerLocal} onChange={(t)=>updateActive(s=>({ ...s, period:{...s.period, violations:{...s.period.violations, centerLocal:t}}}))} />
                      <TripleEditor title="Narrative / facts gap" t={active.period.violations.narrativeGap} onChange={(t)=>updateActive(s=>({ ...s, period:{...s.period, violations:{...s.period.violations, narrativeGap:t}}}))} />
                      <TripleEditor title="Humanitarian stewardship" t={active.period.violations.humanitarian} onChange={(t)=>updateActive(s=>({ ...s, period:{...s.period, violations:{...s.period.violations, humanitarian:t}}}))} />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-xs text-muted-foreground">Raw V (sum of domain scores, capped at 2)</div>
                      <div className="text-base font-semibold">V = {round2(V)}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-4 rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-semibold mb-1">Repair (R)</div>
                    <RowSlider label="Acknowledgment" value={active.period.repair.ack} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, repair:{...s.period.repair, ack:v}}}))} />
                    <RowSlider label="Reform" value={active.period.repair.reform} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, repair:{...s.period.repair, reform:v}}}))} />
                    <RowSlider label="Compensation" value={active.period.repair.comp} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, repair:{...s.period.repair, comp:v}}}))} />
                    <RowSlider label="Inclusivity" value={active.period.repair.inclusive} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, repair:{...s.period.repair, inclusive:v}}}))} />
                    <RowSlider label="Implementation fidelity" value={active.period.repair.fidelity} onChange={(v)=>updateActive(s=>({ ...s, period:{...s.period, repair:{...s.period.repair, fidelity:v}}}))} />
                    <div className="flex items-center justify-between text-sm"><span>Repair avg</span><span>{round2(Ravg)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span>CapacityFactor = (L+E+K)/3</span><span>{round2(cap)}</span></div>
                    <div className="flex items-center justify-between text-base font-semibold"><span>R = avg × Capacity</span><span>{round2(R)}</span></div>
                  </CardContent>
                </Card>

                <Card className="col-span-3 rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-semibold mb-1">Debt & Flags</div>
                    <div className="flex items-center justify-between text-sm"><span>Baseline D(t-1)</span><Input className="w-24" type="number" step={0.1} value={active.period.baselineD} onChange={e=>updateActive(s=>({ ...s, period:{...s.period, baselineD: parseFloat(e.target.value)||0 } }))} /></div>
                    <div className="flex items-center justify-between text-base font-semibold"><span>D(t) = D + V − R</span><span>{round2(D)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span>R/V ratio</span><span className={rv<0.5?"text-red-600 font-semibold":"text-emerald-600 font-semibold"}>{round2(rv)}</span></div>
                    <div className="text-xs text-muted-foreground">Tipping rules breached: {tf.count} {tf.inWindow?"(Rupture window)":""}</div>
                    <div className="space-y-1 text-xs">
                      <div className={tf.flags.L?"text-red-600":"text-muted-foreground"}>• L < 0.45</div>
                      <div className={tf.flags.E?"text-red-600":"text-muted-foreground"}>• E < 0.60</div>
                      <div className={tf.flags.B?"text-red-600":"text-muted-foreground"}>• B > 0.50</div>
                      <div className={tf.flags.C?"text-red-600":"text-muted-foreground"}>• C > 0.35</div>
                      <div className={tf.flags.Rv?"text-red-600":"text-muted-foreground"}>• R/V < 0.5</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">N-period projection (constant parameters)</div>
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground">Horizon (periods)</Label>
                      <Input className="w-24" type="number" min={1} max={40} value={horizon} onChange={e=>setHorizon(Math.max(1, Math.min(40, parseInt(e.target.value)||8)))} />
                    </div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={simData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="D" stroke="#4f46e5" strokeWidth={3} dot={false} name="Debt D" />
                        <Line type="monotone" dataKey="V" stroke="#f97316" strokeWidth={2} dot={false} name="Violations V" />
                        <Line type="monotone" dataKey="R" stroke="#10b981" strokeWidth={2} dot={false} name="Repair R" />
                        <ReferenceLine y={0} stroke="#9ca3af" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compare">
          <div className="grid grid-cols-12 gap-5">
            <Card className="col-span-6 rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-semibold">Dates (optional, for lead-time testing)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Event Date (rupture/repair)</Label>
                    <Input placeholder="YYYY-MM-DD" value={active.eventDate||""} onChange={e=>updateActive(s=>({ ...s, eventDate:e.target.value }))} />
                  </div>
                  <div>
                    <Label>CD Flag Date</Label>
                    <Input placeholder="YYYY-MM-DD" value={active.cdFlagDate||""} onChange={e=>updateActive(s=>({ ...s, cdFlagDate:e.target.value }))} />
                  </div>
                  <div>
                    <Label>Alt Model Name</Label>
                    <Input placeholder="FSI / PITF / Polity …" value={active.altModelName||""} onChange={e=>updateActive(s=>({ ...s, altModelName:e.target.value }))} />
                  </div>
                  <div>
                    <Label>Alt Model Flag Date</Label>
                    <Input placeholder="YYYY-MM-DD" value={active.altFlagDate||""} onChange={e=>updateActive(s=>({ ...s, altFlagDate:e.target.value }))} />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Lead-time = Event − Flag. Earlier (larger) is better.</div>
              </CardContent>
            </Card>

            <Card className="col-span-6 rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-semibold">Lead-time results</div>
                <LeadTimeReadout eventDate={active.eventDate} cdFlagDate={active.cdFlagDate} altFlagDate={active.altFlagDate} altName={active.altModelName} />
                <div className="text-xs text-muted-foreground">Note: This comparison is a scaffold. For rigorous testing, sync to external indices and define objective flag thresholds.</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="about">
          <Card className="rounded-2xl">
            <CardContent className="p-6 space-y-4 text-sm leading-6">
              <div className="text-base font-semibold">What this does</div>
              <p>Interactive implementation of the GoG Contradiction Debt model. Change inputs, see V, R, D, R/V, and tipping flags update instantly. Project D across N periods with constant parameters.</p>
              <div className="text-base font-semibold">How V and R are computed</div>
              <ul className="list-disc ml-6">
                <li>V = Σ(scope × severity × salience) across domains, capped at 2.</li>
                <li>R = average(Ack, Reform, Compensation, Inclusivity, Fidelity) × CapacityFactor.</li>
                <li>CapacityFactor = (L + E + K) / 3.</li>
              </ul>
              <div className="text-base font-semibold">Tipping rules</div>
              <ul className="list-disc ml-6">
                <li>L &lt; 0.45, E &lt; 0.60, B &gt; 0.50, C &gt; 0.35, R/V &lt; 0.5. Two or more ⇒ rupture window.</li>
              </ul>
              <div className="text-base font-semibold">Notes</div>
              <p>This playground is for research and teaching. Values are illustrative; please replace with your data and document sources.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadTimeReadout({eventDate, cdFlagDate, altFlagDate, altName}:{eventDate?:string, cdFlagDate?:string, altFlagDate?:string, altName?:string}){
  function daysBetween(a?:string,b?:string){
    if(!a || !b) return undefined;
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if(Number.isNaN(da) || Number.isNaN(db)) return undefined;
    return Math.round((da - db)/(1000*60*60*24));
  }
  const leadCD = daysBetween(eventDate, cdFlagDate);
  const leadAlt = daysBetween(eventDate, altFlagDate);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span>CD lead-time (days)</span>
        <span className="font-semibold">{leadCD ?? "—"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{altName||"Alt model"} lead-time (days)</span>
        <span className="font-semibold">{leadAlt ?? "—"}</span>
      </div>
      {leadCD!==undefined && leadAlt!==undefined && (
        <div className="flex items-center justify-between text-sm">
          <span>Lead-time advantage (CD − Alt)</span>
          <span className={leadCD>leadAlt?"text-emerald-600 font-semibold":"text-red-600 font-semibold"}>{leadCD - leadAlt}</span>
        </div>
      )}
    </div>
  );
}
