export function tokenize(input: string, version: "IPv4" | "IPv6") {
  if (version === "IPv4") return [...input];
  const tokens: string[] = [];
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === ":" && input[index + 1] === ":") { tokens.push("::"); index += 1; }
    else tokens.push(input[index]);
  }
  return tokens;
}

export function detectVersion(input: string): "IPv4" | "IPv6" {
  return input.includes(":") ? "IPv6" : "IPv4";
}
