import type { DFA, SimulationResult } from "./types";

function matches(symbol: string, pattern: string) {
  if (pattern === "digit") return /^[0-9]$/.test(symbol);
  if (pattern === "hex") return /^[0-9a-fA-F]$/.test(symbol);
  if (pattern.includes("-")) {
    const [start, end] = pattern.split("-");
    return symbol >= start && symbol <= end;
  }
  return symbol === pattern;
}

export function simulateDFA(dfa: DFA, tokens: string[]): SimulationResult {
  let currentState = dfa.startState;
  const steps = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const symbol = tokens[index];
    const transition = dfa.transitions.find((item) => item.from === currentState && item.symbols.some((pattern) => matches(symbol, pattern)));
    const nextState = transition?.to ?? dfa.deadState;
    const transitionExists = Boolean(transition);
    steps.push({
      stepNumber: index + 1,
      symbol,
      currentState,
      nextState,
      transitionExists,
      explanation: transition?.description ?? `The symbol "${symbol}" has no transition from ${currentState}, so the DFA enters DEAD.`,
    });
    currentState = nextState;
    if (currentState === dfa.deadState) break;
  }
  const accepted = dfa.acceptStates.includes(currentState);
  return { steps, finalState: currentState, accepted, reason: accepted ? "The input ended in an accepting state." : currentState === dfa.deadState ? "The DFA reached DEAD after an invalid transition." : "The input ended before reaching an accepting state." };
}
