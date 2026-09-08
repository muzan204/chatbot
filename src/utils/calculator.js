import { UserError } from "./safety.js";
// Parser aritmético; não executa JavaScript nem acessa propriedades.
export function calculate(input) {
  const source = input.replace(/\s/g, "").replace(/,/g, ".");
  const tokens = source.match(/\d+(?:\.\d+)?|[()+*/%-]/g) || [];
  if (!source || tokens.join("") !== source || tokens.length > 100)
    throw new UserError("Use números e + - * / % ( ).");
  let i = 0;
  function atom() {
    if (tokens[i] === "-") {
      i++;
      return -atom();
    }
    if (tokens[i] === "+") {
      i++;
      return atom();
    }
    if (tokens[i] === "(") {
      i++;
      const n = sum();
      if (tokens[i++] !== ")") throw new UserError("Parênteses inválidos.");
      return n;
    }
    const t = tokens[i++];
    if (!/^\d/.test(t || "")) throw new UserError("Expressão inválida.");
    return Number(t);
  }
  function product() {
    let n = atom();
    while (["*", "/", "%"].includes(tokens[i])) {
      const op = tokens[i++],
        b = atom();
      n = op === "*" ? n * b : op === "/" ? n / b : n % b;
    }
    return n;
  }
  function sum() {
    let n = product();
    while (["+", "-"].includes(tokens[i])) {
      const op = tokens[i++],
        b = product();
      n = op === "+" ? n + b : n - b;
    }
    return n;
  }
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result))
    throw new UserError("Expressão inválida ou divisão por zero.");
  return result;
}
