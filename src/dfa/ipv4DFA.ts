import type { DFA, DFAState, DFATransition } from "./types";

const ranges = ["first", "second", "third", "fourth"];
const states: DFAState[] = [{ id: "v4-start", label: "q0", type: "start" }, { id: "v4-dead", label: "DEAD", type: "dead" }];
const transitions: DFATransition[] = [];
const groups = ["zero", "one", "two", "three", "ten", "twenty", "twentyfive", "thirty", "hundred", "twohundred", "twofifty"];
const nextGroup: Record<string, string> = { zero: "dot", one: "ten", two: "twenty", three: "thirty", ten: "hundred", twenty: "twohundred", twentyfive: "twofifty", thirty: "dead", hundred: "dead", twohundred: "dead", twofifty: "dead" };

for (let position = 0; position < 4; position += 1) {
  for (const group of groups) {
    const id = `v4-${position}-${group}`;
    states.push({ id, label: `${ranges[position]} ${group}`, type: position === 3 ? "accept" : "normal" });
  }
  const start = position === 0 ? "v4-start" : `v4-${position}-start`;
  if (position > 0) {
    states.push({ id: start, label: `octet ${position + 1}`, type: "normal" });
  }
  transitions.push({ from: start, to: `v4-${position}-zero`, symbols: ["0"], description: "A zero is a complete octet by itself; another digit would create a leading zero." });
  transitions.push({ from: start, to: `v4-${position}-one`, symbols: ["1"], description: "The octet begins with 1 and may grow to 10–199." });
  transitions.push({ from: start, to: `v4-${position}-two`, symbols: ["2"], description: "The octet begins with 2; the next digit controls the 200–255 range." });
  transitions.push({ from: start, to: `v4-${position}-three`, symbols: ["3-9"], description: "The octet begins with 3–9 and may have one more digit." });
  const add = (from: string, to: string, symbols: string[], description: string) => transitions.push({ from: `v4-${position}-${from}`, to: to === "dead" ? "v4-dead" : `v4-${position}-${to}`, symbols, description });
  add("one", "ten", ["0-9"], "A second digit forms a value from 10–19.");
  add("two", "twenty", ["0-4"], "A second digit forms a value from 20–24.");
  add("two", "twentyfive", ["5"], "25 is the highest two-digit prefix that can become a valid 255.");
  add("two", "dead", ["6-9"], "26–29 cannot accept a third digit without exceeding 255.");
  add("three", "thirty", ["0-9"], "A second digit forms a value from 30–99.");
  add("ten", "hundred", ["0-9"], "100–199 is within the octet range.");
  add("twenty", "twohundred", ["0-9"], "200–249 is within the octet range.");
  add("twentyfive", "twofifty", ["0-5"], "250–255 is within the octet range; only 0–5 may complete it.");
  add("twentyfive", "dead", ["6-9"], "256–259 exceed the maximum octet value 255.");
  for (const group of groups) {
    const id = `v4-${position}-${group}`;
    if (position < 3) transitions.push({ from: id, to: `v4-${position + 1}-start`, symbols: ["."], description: "A dot closes this octet and opens the next octet." });
  }
}
for (const state of states.filter((item) => item.id.includes("dead"))) transitions.push({ from: state.id, to: "v4-dead", symbols: ["digit", ".", "::", ":"], description: "Once DEAD is reached, every remaining symbol keeps the input rejected." });
export const ipv4DFA: DFA = { id: "ipv4", name: "IPv4 octet DFA", states, transitions, startState: "v4-start", acceptStates: states.filter((state) => state.type === "accept").map((state) => state.id), deadState: "v4-dead" };
