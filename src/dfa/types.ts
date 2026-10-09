export type DFAStateType = "start" | "normal" | "accept" | "dead";

export type DFAState = { id: string; label: string; type: DFAStateType };
export type DFATransition = { from: string; to: string; symbols: string[]; description?: string };
export type DFA = { id: string; name: string; states: DFAState[]; transitions: DFATransition[]; startState: string; acceptStates: string[]; deadState: string; };
export type SimulationStep = { stepNumber: number; symbol: string; currentState: string; nextState: string; transitionExists: boolean; explanation: string };
export type SimulationResult = { steps: SimulationStep[]; finalState: string; accepted: boolean; reason: string };
