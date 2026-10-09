# IP DFA Visualizer — System Architecture & DFA Explanation

This document explains how this project works, what defines valid IPv4 and IPv6 addresses, and how the Deterministic Finite Automata (DFA) validate them step-by-step.

---

## 1. Project Overview & Architecture

This project is an interactive **Formal Automata & Formal Languages (FAFL)** laboratory built with Next.js, React Flow (`@xyflow/react`), TypeScript, and Vitest.

### Core Components Pipeline

```
[ Raw IP String Input ]
          │
          ▼
   1. Tokenizer (src/utils/tokenization.ts)
          │
          │ Converts string into an array of symbol tokens (Σ)
          ▼
   2. DFA Definition (src/dfa/ipv4DFA.ts / ipv6DFA.ts)
          │
          │ Formal 5-tuple: Q, Σ, δ, q0, F, and DEAD state
          ▼
   3. Simulator Engine (src/dfa/simulator.ts)
          │
          │ Iterates tokens, executes transitions δ(q, symbol)
          ▼
   4. React Flow UI (src/app/visualizer/page.tsx)
          │
          └─► Visual graph, node highlighting, tape cursor, step logs
```

- **`src/dfa/types.ts`**: Formal DFA interfaces (`DFA`, `DFAState`, `DFATransition`, `SimulationStep`, `SimulationResult`).
- **`src/utils/tokenization.ts`**: Converts address string to input tokens.
  - IPv4: Split into individual characters `['1', '9', '2', '.', ...]`.
  - IPv6: Single colons and hex characters are single tokens; double-colons `"::"` are combined into a single `"::"` token.
- **`src/dfa/simulator.ts`**: Pure DFA transition stepper. Given $(Q, \Sigma, \delta, q_0, F)$, it reads symbol by symbol and checks if a transition exists. If no transition exists from current state $q$ on symbol $a$, it moves to `DEAD`.
- **`src/dfa/ipv4DFA.ts`**: Constructs the state machine for IPv4 octet bounds ($0$ to $255$) and leading-zero rejection.
- **`src/dfa/ipv6DFA.ts`**: Constructs the state machine for IPv6 groups ($1$ to $4$ hex digits, up to $8$ groups, optional single `::` compression).
- **`src/dfa/dfa.test.ts`**: Automated Vitest test suite.

---

## 2. What Constitutes Valid IPv4 & IPv6 Addresses?

### A. Valid IPv4 Rules
1. **Four Octets**: Format must be `A.B.C.D` (exactly 3 dots separating 4 numbers).
2. **Value Range**: Each octet must be between `0` and `255` inclusive.
3. **No Leading Zeros**: Numbers like `01`, `007`, `00` are strictly invalid. Only a standalone `0` is allowed.
4. **Punctuation & Characters**: Only decimal digits `0-9` and dots `.`. No trailing, leading, or consecutive dots (`..`).

*Examples:*
- **Valid**: `0.0.0.0`, `192.168.1.1`, `255.255.255.255`, `10.0.5.21`
- **Invalid**:
  - `256.0.0.1` (octet value 256 > 255)
  - `01.2.3.4` (leading zero in `01`)
  - `192.168.1` (missing 4th octet)
  - `192..1.1` (consecutive dots / empty octet)

---

### B. Valid IPv6 Rules
1. **Eight Groups**: Up to 8 groups separated by colons `:`.
2. **Group Length**: Each group consists of 1 to 4 hexadecimal digits (`0-9`, `a-f`, `A-F`).
3. **Zero Compression (`::`)**:
   - Consecutive groups of zeros can be omitted once using `::`.
   - `::` can appear **at most once** across the entire address.
   - Example: `2001:db8:0:0:0:0:0:1` can be written as `2001:db8::1`.
   - The loopback address `0:0:0:0:0:0:0:1` is written as `::1`.
   - The all-zeros address is written as `::`.

*Examples:*
- **Valid**: `::`, `::1`, `2001:db8::1`, `fe80::1`, `2001:0db8:0000:0000:0000:0000:0000:0001`
- **Invalid**:
  - `2001::db8::1` (contains two `::` compressions)
  - `2001:db8:zz::1` (`z` is not a hex digit)
  - `2001:db8:12345::1` (5 hex characters in one group)

---

## 3. Deep Dive: How the IPv4 DFA Works

### The Fundamental Challenge
A pure DFA cannot do dynamic integer comparisons like `val <= 255`. It has no variables, arithmetic units, or memory other than its **finite set of states**.

Therefore, the DFA must encode the range **0 to 255** and the **no leading zero rule** purely through the topology of state transitions!

---

### Structure of an Octet Sub-machine

For each of the 4 octet positions (`p = 0, 1, 2, 3`), the DFA has a set of states that track the number formed so far by the digits read.

#### States inside Octet `p`:
| State Name | Represents / Accumulated Value |
|---|---|
| `v4-p-start` | Start of octet `p` (awaiting 1st digit) |
| `v4-p-zero` | Read digit `0` (value = 0) |
| `v4-p-one` | Read digit `1` (value = 1) |
| `v4-p-two` | Read digit `2` (value = 2) |
| `v4-p-three` | Read digit `3` through `9` (value = 3–9) |
| `v4-p-ten` | Read two digits: `10` through `19` |
| `v4-p-twenty` | Read two digits: `20` through `24` |
| `v4-p-twentyfive` | Read two digits: exactly `25` |
| `v4-p-thirty` | Read two digits: `30` through `99` |
| `v4-p-hundred` | Read three digits: `100` through `199` |
| `v4-p-twohundred` | Read three digits: `200` through `249` |
| `v4-p-twofifty` | Read three digits: `250` through `255` |

---

### Transition Logic Breakdown

```
                         [ start ]
                        /   |   \   \
             '0'       /    |    \   \  '3'-'9'
            ┌─────────┘    '1'   '2'  └───┐
            ▼               │     │       ▼
        [ zero ]          [one] [two]   [three]
        (Accepts only '.')  │     │       │
                            │     ├─ '0'-'4' ──► [ twenty ] ─── '0'-'9' ──► [ twohundred ] (200-249)
                            │     ├─ '5'     ──► [ twentyfive ] ─ '0'-'5' ──► [ twofifty ] (250-255)
                            │     └─ '6'-'9' ──► [ DEAD ] (260-299 is invalid)
                            │
                            └─ '0'-'9' ────────► [ ten ] (10-19) ─ '0'-'9' ──► [ hundred ] (100-199)
```

#### Rule 1: Leading Zero Prevention
- From `v4-p-start`, input `'0'` moves to `v4-p-zero`.
- From `v4-p-zero`, **there are NO transitions for any digits (`0-9`)**.
- The only valid outgoing transition from `v4-p-zero` is a dot `.` to the next octet (or ending the input if on the 4th octet).
- If the input is `"01"`, reading `'0'` puts the DFA in `v4-p-zero`. When `'1'` arrives, there is no valid transition, so the DFA enters `DEAD` immediately!

#### Rule 2: Single-Digit Numbers (1 to 9)
- Reading `'1'` $\to$ `v4-p-one`.
- Reading `'2'` $\to$ `v4-p-two`.
- Reading `'3'` through `'9'` $\to$ `v4-p-three`.
- Any of these can immediately transition via `.` to the next octet if the number is only 1 digit (e.g. `1.`, `2.`, `9.`).

#### Rule 3: Two-Digit Numbers (10 to 99)
- From `v4-p-one`: on `'0'-'9'` $\to$ `v4-p-ten` (values 10–19).
- From `v4-p-two`:
  - On `'0'-'4'` $\to$ `v4-p-twenty` (values 20–24).
  - On `'5'` $\to$ `v4-p-twentyfive` (value 25).
  - On `'6'-'9'` $\to$ `DEAD` if a third digit is attempted, because $26X \dots 29X > 255$.
- From `v4-p-three`: on `'0'-'9'` $\to$ `v4-p-thirty` (values 30–99).
- Any of these states can transition via `.` to the next octet.

#### Rule 4: Three-Digit Numbers (100 to 255)
- From `v4-p-ten` (10–19): on any digit `'0'-'9'` $\to$ `v4-p-hundred` (values 100–199). Valid!
- From `v4-p-twenty` (20–24): on any digit `'0'-'9'` $\to$ `v4-p-twohundred` (values 200–249). Valid!
- From `v4-p-twentyfive` (25):
  - On `'0'-'5'` $\to$ `v4-p-twofifty` (values 250–255). Valid!
  - On `'6'-'9'` $\to$ `DEAD`! (Values 256–259 exceed 255).
- From `v4-p-thirty` (30–99): any third digit has no transition $\to$ `DEAD`! (Values 300–999 exceed 255).
- Any four-digit number: none of the 3-digit states have transitions on digits $\to$ `DEAD`!

#### Rule 5: Octet Progression via Dot (`.`)
- Every valid numeric terminal state in octet $p$ (`p < 3`):
  `zero`, `one`, `two`, `three`, `ten`, `twenty`, `twentyfive`, `thirty`, `hundred`, `twohundred`, `twofifty`
  has a transition on symbol `.` to `v4-(p+1)-start`.
- If an octet is empty (e.g., `192..1.1`), from `v4-0-dot` or `v4-1-start`, receiving another `.` has no transition and goes to `DEAD`.

#### Rule 6: Acceptance Criterion
- Only the completed number states in **octet 3** (the fourth octet, index 3) are marked as `type: "accept"`.
- If the string ends after 1, 2, or 3 octets, the DFA is not in an accept state, so the input is rejected.

---

### Step-by-Step Simulation Traces

#### Example A: Valid Input `192.168.1.1`
1. Read `'1'` $\to$ state `v4-0-one`
2. Read `'9'` $\to$ state `v4-0-ten`
3. Read `'2'` $\to$ state `v4-0-hundred` (Value 192)
4. Read `'.'` $\to$ state `v4-1-start`
5. Read `'1'` $\to$ state `v4-1-one`
6. Read `'6'` $\to$ state `v4-1-ten`
7. Read `'8'` $\to$ state `v4-1-hundred` (Value 168)
8. Read `'.'` $\to$ state `v4-2-start`
9. Read `'1'` $\to$ state `v4-2-one` (Value 1)
10. Read `'.'` $\to$ state `v4-3-start`
11. Read `'1'` $\to$ state `v4-3-one` (Value 1, Accept state)
12. End of input $\to$ State is in `acceptStates` $\Rightarrow$ **ACCEPTED**

---

#### Example B: Invalid Input `256.0.0.1` (Exceeds 255)
1. Read `'2'` $\to$ state `v4-0-two`
2. Read `'5'` $\to$ state `v4-0-twentyfive`
3. Read `'6'` $\to$ No transition to `twofifty` (only `0-5` allowed). Transitions to `v4-dead`.
4. Once in `DEAD`, every remaining symbol keeps it in `DEAD`.
5. End of input $\to$ State is `DEAD` $\Rightarrow$ **REJECTED**

---

#### Example C: Invalid Input `01.2.3.4` (Leading Zero)
1. Read `'0'` $\to$ state `v4-0-zero`
2. Read `'1'` $\to$ `v4-0-zero` has NO transition on digits (only on `.`). Transitions to `v4-dead`.
3. End of input $\to$ State is `DEAD` $\Rightarrow$ **REJECTED**

---

#### Example D: Invalid Input `192.168.1.1.1` (More Than 4 Octets)
1. Successfully reads `192.168.1.1` $\to$ reaches state `v4-3-one` (the 4th octet).
2. The next symbol is the fourth dot `'.'`.
3. In `src/dfa/ipv4DFA.ts`, dot transitions are only defined for `position < 3` (`octet 1, 2, 3`). **There are NO dot transitions leaving octet 4 (`position = 3`)**.
4. The simulator fails to find a transition from `v4-3-one` on `'.'` $\to$ moves to `v4-dead`.
5. Any subsequent symbols (e.g. `'1'`) keep the DFA trapped in `DEAD`.
6. End of input $\to$ State is `DEAD` $\Rightarrow$ **REJECTED**

---

### How More Than 4 Octets Are Handled (Mechanism Summary)

In [ipv4DFA.ts](file:///d:/Atharva/Projects/FAFL/src/dfa/ipv4DFA.ts#L35):
```typescript
if (position < 3) {
  transitions.push({
    from: id,
    to: `v4-${position + 1}-start`,
    symbols: ["."],
    description: "A dot closes this octet and opens the next octet."
  });
}
```

1. **Strict 3-Dot Bound**: Dots are only accepted after octets `0`, `1`, and `2` (the 1st, 2nd, and 3rd octets).
2. **Absence of Transitions**: For `position = 3` (the 4th octet), no transition on `'.'` is registered in `dfa.transitions`.
3. **Automatic Fallback to DEAD**:
   In [simulator.ts](file:///d:/Atharva/Projects/FAFL/src/dfa/simulator.ts#L18-L19):
   ```typescript
   const transition = dfa.transitions.find((item) =>
     item.from === currentState && item.symbols.some((pattern) => matches(symbol, pattern))
   );
   const nextState = transition?.to ?? dfa.deadState; // Falls back to v4-dead!
   ```
   When the simulator encounters a 4th dot after the 4th octet, `transition` is `undefined`, immediately sending the DFA to `v4-dead`.


## 4. How the IPv6 DFA Works

In `src/dfa/ipv6DFA.ts`:

1. **State Space**:
   - States of the form `v6-g{groupCount}-{length}` track:
     - `groupCount`: Group index from $0$ to $7$.
     - `length`: Number of hexadecimal characters ($1$ to $4$).
2. **Hex Transitions**:
   - Each hex character (`0-9`, `a-f`, `A-F`) increments `length` ($1 \to 2 \to 3 \to 4$).
   - A 5th hex character has no transition $\to$ `DEAD`.
3. **Colon Transitions**:
   - A single colon `:` moves from any valid group length ($1 \dots 4$) to `v6-colon-{groupCount}`.
   - The next hex character transitions to group `groupCount + 1`, length $1$.
4. **Zero Compression Branch (`::`)**:
   - The tokenizer yields `::` as a distinct token.
   - Reading `::` moves the DFA into compression tracking states: `v6-comp-{leftGroups}-{rightGroups}`.
   - Since the compression sub-graph does not have transitions on `::`, **a second occurrence of `::` immediately triggers `DEAD`** (satisfying the RFC rule that `::` can only appear once).
   - Tracks total left and right groups to ensure the total is $\le 7$.
5. **Acceptance**:
   - Fully expanded: Group 8 (`g7`) with 1 to 4 characters.
   - Compressed: Any state `v6-comp-{left}-{right}` where `left + right < 8`.

---

## 5. Summary Table: DFA Properties

| Property | IPv4 DFA | IPv6 DFA |
|---|---|---|
| **Alphabet ($\Sigma$)** | `0-9`, `.` | `0-9`, `a-f`, `A-F`, `:`, `::` |
| **Tokens** | Character-by-character | Characters, with `::` combined |
| **Key Invariant** | Exactly 4 octets, each $0 \le x \le 255$, no leading zero | 1–8 groups of 1–4 hex chars, at most one `::` |
| **Invalid Trap** | `v4-dead` | `v6-dead` |
| **Accepting States** | Any valid number ending in 4th octet | 8th group complete, or valid compressed groups |
