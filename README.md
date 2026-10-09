# IP DFA Visualizer

An interactive Automata Theory laboratory for tracing IPv4 and IPv6 validation symbol by symbol. The app uses Next.js, TypeScript, React Flow, Framer Motion-compatible client patterns, and Lucide icons.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/visualizer`.

## Architecture

- `src/dfa/types.ts` defines the generic DFA and simulation contracts.
- `src/dfa/simulator.ts` executes transitions and produces explanations.
- `src/dfa/ipv4DFA.ts` models decimal octet bounds and leading-zero rejection.
- `src/dfa/ipv6DFA.ts` models hexadecimal groups and one optional `::` branch.
- `src/app/visualizer/page.tsx` renders the React Flow graph and simulation controls.

Validation decisions come from the simulator and DFA transitions. Tokenization only turns the address into input symbols.

## Tests

```bash
npm test
```

## Extending

Add another `DFA` object that follows the types in `src/dfa/types.ts`. The simulator, token tape, controls, explanations, and graph renderer can consume it without changing their core contracts.
