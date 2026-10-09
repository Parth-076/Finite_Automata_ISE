import type { DFA, DFAState, DFATransition } from "./types";

const states: DFAState[] = [{ id: "v6-start", label: "q0 · start", type: "start" }, { id: "v6-dead", label: "DEAD", type: "dead" }];
const transitions: DFATransition[] = [];
const hex = ["hex"];
const addState = (id: string, label: string, type: DFAState["type"] = "normal") => states.push({ id, label, type });
const add = (from: string, to: string, symbols: string[], description: string) => transitions.push({ from, to, symbols, description });
for (let groupCount = 0; groupCount <= 8; groupCount += 1) {
  for (let length = 1; length <= 4; length += 1) {
    const id = `v6-g${groupCount}-${length}`;
    addState(id, `g${groupCount + 1} · ${length}/4`, groupCount === 7 && length >= 1 ? "accept" : "normal");
    add(id, `v6-g${groupCount}-${length + 1}`, hex, "A hexadecimal character extends the current group.");
    if (length === 1) add(`v6-g${groupCount}-0`, id, hex, "A hexadecimal character begins a new IPv6 group.");
  }
  addState(`v6-g${groupCount}-0`, `groups ${groupCount}`, "normal");
  if (groupCount < 8) {
    add(`v6-g${groupCount}-0`, `v6-g${groupCount + 1}-1`, hex, "A hexadecimal character begins the next group.");
    add(`v6-g${groupCount}-4`, `v6-colon-${groupCount}`, [":"], "A single colon separates two hexadecimal groups.");
    add(`v6-g${groupCount}-1`, `v6-colon-${groupCount}`, [":"], "A single colon separates two hexadecimal groups.");
    add(`v6-g${groupCount}-2`, `v6-colon-${groupCount}`, [":"], "A single colon separates two hexadecimal groups.");
    add(`v6-g${groupCount}-3`, `v6-colon-${groupCount}`, [":"], "A single colon separates two hexadecimal groups.");
  }
  if (groupCount < 8) {
    add(`v6-g${groupCount}-0`, `v6-comp-${groupCount}-0`, ["::"], "IPv6 zero-compression is detected. It stands for one or more omitted zero groups.");
    for (let length = 1; length <= 4; length += 1) add(`v6-g${groupCount}-${length}`, `v6-comp-${groupCount}-0`, ["::"], "IPv6 zero-compression is detected. It stands for one or more omitted zero groups.");
  }
  if (groupCount === 0) add("v6-start", "v6-g0-1", hex, "A hexadecimal character begins the first IPv6 group.");
}
for (let groupCount = 0; groupCount < 8; groupCount += 1) {
  addState(`v6-colon-${groupCount}`, `colon after ${groupCount}`);
  add(`v6-colon-${groupCount}`, `v6-g${groupCount + 1}-1`, hex, "The next hexadecimal character begins another group.");
  add(`v6-colon-${groupCount}`, `v6-comp-${groupCount}-0`, [":"], "The second colon activates zero-compression.");
  for (let right = 0; right <= 7 - groupCount; right += 1) {
    const state = `v6-comp-${groupCount}-${right}`;
    addState(state, `:: · ${groupCount}+${right}` , groupCount + right < 8 && (groupCount + right) < 8 ? "accept" : "normal");
    if (right < 7 - groupCount) add(state, `v6-comp-${groupCount}-${right + 1}`, hex, "A hexadecimal group appears after the compressed zero run.");
    if (right > 0 && groupCount + right < 7) add(state, `v6-comp-${groupCount}-${right}-colon`, [":"], "A colon separates groups after the compression marker.");
  }
}
add("v6-start", "v6-comp-0-0", ["::"], "IPv6 zero-compression is detected at the beginning of the address.");
for (const state of states) if (state.id !== "v6-dead") add(state.id, "v6-dead", ["digit", "."], "This symbol is not valid in the current IPv6 state.");
export const ipv6DFA: DFA = { id: "ipv6", name: "IPv6 group DFA", states, transitions, startState: "v6-start", acceptStates: states.filter((state) => state.type === "accept").map((state) => state.id), deadState: "v6-dead" };
