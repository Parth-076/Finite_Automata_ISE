import { describe, expect, it } from "vitest";
import { ipv4DFA } from "./ipv4DFA";
import { ipv6DFA } from "./ipv6DFA";
import { simulateDFA } from "./simulator";
import { tokenize } from "../utils/tokenization";

const cases = [
  ["0.0.0.0", "IPv4", true], ["1.2.3.4", "IPv4", true], ["192.168.1.1", "IPv4", true], ["255.255.255.255", "IPv4", true],
  ["256.0.0.1", "IPv4", false], ["01.2.3.4", "IPv4", false], ["192.168.1", "IPv4", false], ["192..1.1", "IPv4", false],
  ["::", "IPv6", true], ["::1", "IPv6", true], ["2001:db8::1", "IPv6", true], ["fe80::1", "IPv6", true],
  ["2001:db8:0:0:0:0:0:1", "IPv6", true], ["2001::db8::1", "IPv6", false], ["2001:db8:zz::1", "IPv6", false], ["2001:db8:12345::1", "IPv6", false],
] as const;

describe("IP DFA simulators", () => {
  it.each(cases)("classifies %s", (input, version, expected) => {
    const dfa = version === "IPv4" ? ipv4DFA : ipv6DFA;
    expect(simulateDFA(dfa, tokenize(input, version)).accepted).toBe(expected);
  });
});
