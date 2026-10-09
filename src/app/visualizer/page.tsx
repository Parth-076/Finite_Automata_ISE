"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import type { Edge, Node } from "@xyflow/react";
import { Background, Controls, MarkerType, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ipv4DFA } from "../../dfa/ipv4DFA";
import { ipv6DFA } from "../../dfa/ipv6DFA";
import { simulateDFA } from "../../dfa/simulator";
import type { DFA, SimulationResult } from "../../dfa/types";
import { detectVersion, tokenize } from "../../utils/tokenization";

const examples = { IPv4: "192.168.1.1", IPv6: "2001:db8::1" };
const initialResult: SimulationResult = { steps: [], finalState: "", accepted: false, reason: "Enter an address and start the simulation." };

const octetNames = ["1st Octet", "2nd Octet", "3rd Octet", "4th Octet"];
const groupValues: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3–9",
  ten: "10–19",
  twenty: "20–24",
  twentyfive: "25",
  thirty: "30–99",
  hundred: "100–199",
  twohundred: "200–249",
  twofifty: "250–255",
};

const groupGridCoords: Record<string, { col: number; row: number }> = {
  zero: { col: 1, row: 0 },
  one: { col: 1, row: 1 },
  two: { col: 1, row: 2 },
  three: { col: 1, row: 3 },
  ten: { col: 2, row: 1 },
  twenty: { col: 2, row: 2 },
  twentyfive: { col: 2, row: 3 },
  thirty: { col: 2, row: 4 },
  hundred: { col: 3, row: 1 },
  twohundred: { col: 3, row: 2 },
  twofifty: { col: 3, row: 3 },
};

function getActiveOctet(stateId: string): number {
  if (!stateId) return 0;
  if (stateId === "v4-start" || stateId.startsWith("v4-0-")) return 0;
  if (stateId.startsWith("v4-1-")) return 1;
  if (stateId.startsWith("v4-2-")) return 2;
  if (stateId.startsWith("v4-3-")) return 3;
  return -1;
}

function getIpv4GraphData(dfa: DFA, result: SimulationResult, cursor: number, scope: string): { nodes: Node[]; edges: Edge[] } {
  const activeStep = result.steps[cursor - 1];
  const activeStateId = cursor === 0 ? dfa.startState : (activeStep?.nextState ?? result.finalState);
  const isAll = scope === "all";
  const selectedOctet = isAll ? -1 : parseInt(scope, 10);

  let targetStates = dfa.states.filter((state) => state.id !== dfa.deadState);

  if (!isAll && selectedOctet >= 0 && selectedOctet <= 3) {
    const octetPrefix = `v4-${selectedOctet}-`;
    const startId = selectedOctet === 0 ? "v4-start" : `v4-${selectedOctet}-start`;
    const nextStartId = selectedOctet < 3 ? `v4-${selectedOctet + 1}-start` : null;

    targetStates = dfa.states.filter((s) => {
      if (s.id === startId) return true;
      if (s.id.startsWith(octetPrefix)) return true;
      if (nextStartId && s.id === nextStartId) return true;
      return false;
    });
  }

  // Include DEAD state if reached
  if (activeStateId === dfa.deadState) {
    const deadObj = dfa.states.find((s) => s.id === dfa.deadState);
    if (deadObj && !targetStates.some((s) => s.id === dfa.deadState)) {
      targetStates.push(deadObj);
    }
  }

  const rowY = [40, 135, 230, 325, 420];
  const colX = [40, 185, 335, 485];

  const nodes = targetStates.map((state) => {
    let x = 40;
    let y = 230;
    let labelHeader = "";
    let labelBody = state.label;

    if (state.id === dfa.deadState) {
      x = isAll ? 1050 : 335;
      y = isAll ? 520 : 510;
      labelHeader = "REJECT";
      labelBody = "DEAD";
    } else if (state.id === "v4-start") {
      x = 40;
      y = 230;
      labelHeader = "1ST OCTET";
      labelBody = "q0 · start";
    } else {
      const match = state.id.match(/^v4-(\d+)-(.+)$/);
      if (match) {
        const octetIndex = parseInt(match[1], 10);
        const suffix = match[2];
        const octetOffset = isAll ? octetIndex * 620 : 0;

        if (suffix === "start") {
          x = isAll ? octetOffset + 40 : selectedOctet === octetIndex ? 40 : 640;
          y = 230;
          labelHeader = `${octetNames[octetIndex].toUpperCase()}`;
          labelBody = "entry";
        } else if (groupGridCoords[suffix]) {
          const { col, row } = groupGridCoords[suffix];
          x = octetOffset + colX[col];
          y = rowY[row];
          labelHeader = isAll ? octetNames[octetIndex].toUpperCase() : groupValues[suffix] ? suffix : "";
          labelBody = groupValues[suffix] ? `${groupValues[suffix]}` : state.label;
        }
      }
    }

    const isCurrent = activeStateId === state.id;
    const isDone = result.steps.slice(0, cursor).some((s) => s.currentState === state.id);

    return {
      id: state.id,
      position: { x, y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div>
            {labelHeader && (
              <div style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                {labelHeader}
              </div>
            )}
            <div style={{ fontWeight: 600, fontSize: "12px" }}>{labelBody}</div>
          </div>
        ),
      },
      type: "default",
      className: `node ${state.type} ${isCurrent ? "current" : ""} ${isDone && !isCurrent ? "done" : ""}`,
    };
  });

  const visibleIds = new Set(nodes.map((n) => n.id));

  const edges = dfa.transitions
    .filter((transition) => visibleIds.has(transition.from) && visibleIds.has(transition.to))
    .map((transition, index) => {
      const isTransitionActive =
        activeStep?.currentState === transition.from && activeStep?.nextState === transition.to;
      return {
        id: `${transition.from}-${transition.to}-${index}`,
        source: transition.from,
        target: transition.to,
        type: "smoothstep",
        label: transition.symbols.join(", "),
        animated: isTransitionActive,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: isTransitionActive ? "#f5bd60" : "#566d7b",
          strokeWidth: isTransitionActive ? 3 : 1.2,
        },
        labelStyle: { fill: "#f5bd60", fontFamily: "DM Mono", fontSize: 10 },
        labelBgStyle: { fill: "#0c151e" },
      };
    });

  return { nodes, edges };
}

function getIpv6GraphData(dfa: DFA, result: SimulationResult, cursor: number, scope: string): { nodes: Node[]; edges: Edge[] } {
  const activeStep = result.steps[cursor - 1];
  const activeStateId = cursor === 0 ? dfa.startState : (activeStep?.nextState ?? result.finalState);

  let targetStates = dfa.states.filter((state) => state.id !== dfa.deadState);

  if (scope === "1-2") {
    targetStates = targetStates.filter((s) => s.id === "v6-start" || s.id.startsWith("v6-g0-") || s.id.startsWith("v6-g1-") || s.id === "v6-colon-0" || s.id === "v6-colon-1");
  } else if (scope === "3-4") {
    targetStates = targetStates.filter((s) => s.id.startsWith("v6-g2-") || s.id.startsWith("v6-g3-") || s.id === "v6-colon-2" || s.id === "v6-colon-3");
  } else if (scope === "5-6") {
    targetStates = targetStates.filter((s) => s.id.startsWith("v6-g4-") || s.id.startsWith("v6-g5-") || s.id === "v6-colon-4" || s.id === "v6-colon-5");
  } else if (scope === "7-8") {
    targetStates = targetStates.filter((s) => s.id.startsWith("v6-g6-") || s.id.startsWith("v6-g7-") || s.id === "v6-colon-6" || s.id === "v6-colon-7");
  } else if (scope === "comp") {
    targetStates = targetStates.filter((s) => s.id === "v6-start" || s.id.startsWith("v6-comp-"));
  }

  if (activeStateId === dfa.deadState) {
    const deadObj = dfa.states.find((s) => s.id === dfa.deadState);
    if (deadObj && !targetStates.some((s) => s.id === dfa.deadState)) targetStates.push(deadObj);
  }

  const nodes = targetStates.map((state) => {
    let x = 40;
    let y = 140;

    if (state.id === "v6-start") {
      x = 40;
      y = 120;
    } else if (state.id === dfa.deadState) {
      x = 800;
      y = 440;
    } else {
      const gMatch = state.id.match(/^v6-g(\d+)-(\d+)$/);
      const colonMatch = state.id.match(/^v6-colon-(\d+)$/);
      const compMatch = state.id.match(/^v6-comp-(\d+)-(\d+)$/);

      if (gMatch) {
        const group = parseInt(gMatch[1], 10);
        const len = parseInt(gMatch[2], 10);
        const baseOffset = (scope === "all" ? group : group % 2) * 320;
        x = 160 + baseOffset + (len - 1) * 70;
        y = len === 0 ? 140 : 60;
      } else if (colonMatch) {
        const group = parseInt(colonMatch[1], 10);
        const baseOffset = (scope === "all" ? group : group % 2) * 320;
        x = 160 + baseOffset + 240;
        y = 140;
      } else if (compMatch) {
        const group = parseInt(compMatch[1], 10);
        const right = parseInt(compMatch[2], 10);
        x = 160 + group * 140 + right * 65;
        y = 260 + (right % 2) * 55;
      }
    }

    const isCurrent = activeStateId === state.id;
    const isDone = result.steps.slice(0, cursor).some((s) => s.currentState === state.id);

    return {
      id: state.id,
      position: { x, y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div>
            <div style={{ fontWeight: 600, fontSize: "12px" }}>{state.label}</div>
          </div>
        ),
      },
      type: "default",
      className: `node ${state.type} ${isCurrent ? "current" : ""} ${isDone && !isCurrent ? "done" : ""}`,
    };
  });

  const visibleIds = new Set(nodes.map((n) => n.id));

  const edges = dfa.transitions
    .filter((transition) => visibleIds.has(transition.from) && visibleIds.has(transition.to))
    .map((transition, index) => {
      const isTransitionActive =
        activeStep?.currentState === transition.from && activeStep?.nextState === transition.to;
      return {
        id: `${transition.from}-${transition.to}-${index}`,
        source: transition.from,
        target: transition.to,
        type: "smoothstep",
        label: transition.symbols.join(", "),
        animated: isTransitionActive,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: isTransitionActive ? "#f5bd60" : "#566d7b",
          strokeWidth: isTransitionActive ? 3 : 1.2,
        },
        labelStyle: { fill: "#f5bd60", fontFamily: "DM Mono", fontSize: 10 },
        labelBgStyle: { fill: "#0c151e" },
      };
    });

  return { nodes, edges };
}

export default function VisualizerPage() {
  const [versionMode, setVersionMode] = useState<"Auto" | "IPv4" | "IPv6">("IPv4");
  const [input, setInput] = useState(examples.IPv4);
  const [version, setVersion] = useState<"IPv4" | "IPv6">("IPv4");
  const [scope, setScope] = useState<string>("all");
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [result, setResult] = useState(initialResult);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [error, setError] = useState("");

  const dfa = version === "IPv4" ? ipv4DFA : ipv6DFA;
  const tokens = useMemo(() => tokenize(input, version), [input, version]);
  const activeStep = result.steps[cursor - 1];
  const shownState = cursor === 0 ? dfa.startState : (activeStep?.nextState ?? result.finalState);

  // Automatically follow the active octet when in single-octet view
  useEffect(() => {
    if (autoFollow && version === "IPv4") {
      const currentOctet = getActiveOctet(shownState);
      if (currentOctet >= 0 && scope !== "all") {
        setScope(String(currentOctet));
      }
    }
  }, [shownState, autoFollow, version, scope]);

  const graph = useMemo(() => {
    if (version === "IPv4") {
      return getIpv4GraphData(dfa, result, cursor, scope);
    }
    return getIpv6GraphData(dfa, result, cursor, scope);
  }, [dfa, result, cursor, version, scope]);

  function validate() {
    const chosen = versionMode === "Auto" ? detectVersion(input) : versionMode;
    const trimmed = input.trim();
    if (!trimmed) {
      setError("An address is required before the DFA can run.");
      return;
    }
    if (versionMode === "IPv4" && input.includes(":")) {
      setError("IPv6 punctuation (':') detected. IPv4 addresses only accept decimal digits and dots.");
      return;
    }
    if (versionMode === "IPv6" && input.includes(".")) {
      setError("IPv4 punctuation detected. Switch to IPv4 or Auto.");
      return;
    }
    setError("");
    setVersion(chosen);
    const nextResult = simulateDFA(chosen === "IPv4" ? ipv4DFA : ipv6DFA, tokenize(trimmed, chosen));
    setResult(nextResult);
    setCursor(0);
    setPlaying(false);
  }

  function restart() {
    setCursor(0);
    setPlaying(false);
  }
  function stepNext() {
    setCursor((current) => Math.min(current + 1, result.steps.length));
  }
  function stepPrevious() {
    setCursor((current) => Math.max(current - 1, 0));
  }

  useEffect(() => {
    if (!playing || cursor >= result.steps.length) {
      if (cursor >= result.steps.length) setPlaying(false);
      return;
    }
    const timer = window.setTimeout(stepNext, 1100 / Number(speed));
    return () => window.clearTimeout(timer);
  }, [playing, cursor, result.steps.length, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if (event.key === "ArrowRight") stepNext();
      if (event.key === "ArrowLeft") stepPrevious();
      if (event.key.toLowerCase() === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finalShown = cursor === result.steps.length && result.steps.length > 0;
  const resultTitle = !finalShown ? "Simulation ready" : result.accepted ? "ACCEPTED" : "REJECTED";
  const resultDescription = !finalShown
    ? "Advance through the input to reach a verdict."
    : result.accepted
    ? `${input} is a valid ${version} address. The DFA reached an accepting state.`
    : result.reason;

  const activeOctetIndex = version === "IPv4" ? getActiveOctet(shownState) : -1;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span>δ</span>
          </div>
          <span>IP DFA VISUALIZER</span>
        </div>
        <div className="toplink">AUTOMATA THEORY LAB / 01</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Deterministic finite automata / interactive study</div>
          <h1>
            Watch an address<br />
            <span style={{ color: "var(--cyan)" }}>become a verdict.</span>
          </h1>
          <p className="hero-copy">
            Trace every symbol through a finite-state machine. See structure turn into state, state turn into transition, and transition turn into proof.
          </p>
        </div>
        <div className="signal">
          <strong>LIVE SIMULATION</strong>
          One symbol at a time<br />
          Two automata · zero shortcuts
        </div>
      </section>

      <section className="workspace">
        <aside className="panel sidebar">
          <div>
            <div className="section-label">01 / Input source</div>
            <div className="version-toggle" style={{ gridTemplateColumns: "1fr" }}>
              {(["Auto", "IPv4", "IPv6"] as const).map((item) => (
                <button
                  key={item}
                  style={item !== "IPv4" ? { display: "none" } : undefined}
                  className={versionMode === item ? "active" : ""}
                  onClick={() => {
                    setVersionMode(item);
                    if (item !== "Auto") {
                      setVersion(item);
                      setInput(examples[item]);
                      setScope("all");
                    }
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="input-block">
            <div className="section-label">Address string</div>
            <input
              className="ip-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") validate();
              }}
              spellCheck={false}
              aria-label="IP address"
            />
            <button className="primary" onClick={validate}>
              RUN DFA ANALYSIS <span>↗</span>
            </button>
            {error && <div className="error">{error}</div>}
          </div>
          <div>
            <div className="section-label">Machine selected</div>
            <div style={{ font: "16px 'DM Mono'", color: "var(--cyan)" }}>
              {version} / {dfa.name}
            </div>
            <p className="hint">
              {version === "IPv4"
                ? "Four decimal octets, each bounded by 255. No leading zeros allowed."
                : "Hexadecimal groups with a single optional zero-compression branch."}
            </p>
          </div>
          <div>
            <div className="section-label">Shortcuts</div>
            <p className="hint">
              SPACE play / pause<br />
              ← → step through symbols<br />
              R restart the run
            </p>
          </div>
        </aside>

        <div className="main">
          <div className="panel">
            <div className="graph-head">
              <div>
                <div className="section-label" style={{ marginBottom: 5 }}>02 / State space</div>
                <div className="graph-title">{dfa.name}</div>
              </div>
              <div className="live">● {playing ? "RUNNING" : "STANDBY"}</div>
            </div>

            {/* Scope / Octet selector bar */}
            <div className="scope-bar">
              <div className="scope-tabs">
                {version === "IPv4" ? (
                  <>
                    <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
                      All 4 Octets
                    </button>
                    <button className={scope === "0" ? "active" : ""} onClick={() => setScope("0")}>
                      Octet 1
                    </button>
                    <button className={scope === "1" ? "active" : ""} onClick={() => setScope("1")}>
                      Octet 2
                    </button>
                    <button className={scope === "2" ? "active" : ""} onClick={() => setScope("2")}>
                      Octet 3
                    </button>
                    <button className={scope === "3" ? "active" : ""} onClick={() => setScope("3")}>
                      Octet 4
                    </button>
                  </>
                ) : (
                  <>
                    <button className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>
                      All Groups
                    </button>
                    <button className={scope === "1-2" ? "active" : ""} onClick={() => setScope("1-2")}>
                      Groups 1–2
                    </button>
                    <button className={scope === "3-4" ? "active" : ""} onClick={() => setScope("3-4")}>
                      Groups 3–4
                    </button>
                    <button className={scope === "5-6" ? "active" : ""} onClick={() => setScope("5-6")}>
                      Groups 5–6
                    </button>
                    <button className={scope === "7-8" ? "active" : ""} onClick={() => setScope("7-8")}>
                      Groups 7–8
                    </button>
                    <button className={scope === "comp" ? "active" : ""} onClick={() => setScope("comp")}>
                      Compression (::)
                    </button>
                  </>
                )}
              </div>

              {version === "IPv4" && (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="scope-badge">
                    <span>Active:</span>
                    <strong>
                      {activeOctetIndex >= 0 ? `Octet ${activeOctetIndex + 1}` : shownState === "v4-dead" ? "DEAD" : "—"}
                    </strong>
                  </div>
                  <label className="scope-toggle">
                    <input
                      type="checkbox"
                      checked={autoFollow}
                      onChange={(e) => setAutoFollow(e.target.checked)}
                    />
                    <span>Auto-follow active octet</span>
                  </label>
                </div>
              )}
            </div>

            <div className="graph">
              <div style={{ width: "100%", height: "100%" }}>
                <ReactFlow
                  key={`${version}-${scope}`}
                  nodes={graph.nodes}
                  edges={graph.edges}
                  fitView
                  fitViewOptions={{ padding: 0.15 }}
                  proOptions={{ hideAttribution: true }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  zoomOnDoubleClick={false}
                >
                  <Background color="#263746" gap={28} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </div>

            <div className="tokens">
              <div className="section-label">Input tape / {tokens.length} symbols</div>
              <div className="token-row">
                {tokens.length ? (
                  tokens.map((token, index) => (
                    <span
                      key={`${token}-${index}`}
                      className={`token ${index < cursor ? "done" : ""} ${index === cursor ? "current" : ""}`}
                    >
                      {token === " " ? "·" : token}
                    </span>
                  ))
                ) : (
                  <span className="hint">Awaiting input</span>
                )}
              </div>
            </div>

            <div className="controls">
              <button className="control" onClick={restart} title="Restart">
                <RotateCcw size={14} />
              </button>
              <button className="control" onClick={() => setCursor(0)} title="First">
                <SkipBack size={14} />
              </button>
              <button className="control" onClick={stepPrevious} title="Previous">
                <StepBack size={14} />
              </button>
              <button
                className="control primary-control"
                onClick={() => setPlaying((value) => !value)}
                title="Play or pause"
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button className="control" onClick={stepNext} title="Next">
                <StepForward size={14} />
              </button>
              <button className="control" onClick={() => setCursor(result.steps.length)} title="Last">
                <SkipForward size={14} />
              </button>
              <select
                className="speed"
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
                aria-label="Playback speed"
              >
                <option value="0.5">0.5x speed</option>
                <option value="1">1x speed</option>
                <option value="1.5">1.5x speed</option>
                <option value="2">2x speed</option>
              </select>
            </div>
          </div>

          <div className="info-grid">
            <section className="panel info">
              <div className="section-label">03 / Telemetry</div>
              <div className="readouts">
                <div className="readout">
                  <span>Current symbol</span>
                  <strong>{activeStep?.symbol ?? "—"}</strong>
                </div>
                <div className="readout">
                  <span>Current state</span>
                  <strong>{dfa.states.find((item) => item.id === shownState)?.label ?? shownState}</strong>
                </div>
                <div className="readout">
                  <span>Transition</span>
                  <strong>{activeStep ? `${activeStep.currentState} → ${activeStep.nextState}` : "—"}</strong>
                </div>
                <div className="readout">
                  <span>Step</span>
                  <strong>
                    {cursor} / {result.steps.length}
                  </strong>
                </div>
              </div>
            </section>
            <section className="panel info">
              <div className="section-label">04 / Why it moved</div>
              <p className="explanation">
                {activeStep ? (
                  <>
                    <strong>{activeStep.transitionExists ? "VALID TRANSITION" : "INVALID TRANSITION"}</strong>
                    <br />
                    {activeStep.explanation}
                  </>
                ) : (
                  "Press next or play to inspect the first transition. The explanation will update with every symbol."
                )}
              </p>
            </section>
          </div>

          <section className={`panel result ${finalShown && !result.accepted ? "reject" : ""}`}>
            <div className="section-label">05 / Verdict</div>
            <h2>{resultTitle}</h2>
            <p>{resultDescription}</p>
          </section>
        </div>
      </section>
    </main>
  );
}
