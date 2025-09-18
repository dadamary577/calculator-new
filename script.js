(function () {
  const formulaEl = document.getElementById("formula");
  const resultEl = document.getElementById("result");
  const keys = document.querySelectorAll(".key");

  let expression = "";
  let lastResult = null;

  function updateDisplay() {
    formulaEl.textContent = expression || "\u00A0";
    resultEl.textContent = expression ? expression : "0";
  }

  function roundVal(v) {
    return Math.round(v * 1e12) / 1e12;
  }

  // -------------------------
  // Tokenize -> RPN -> Eval
  // -------------------------
  function tokenize(expr) {
    // Visual → JS
    expr = expr.replace(/×/g, "*").replace(/÷/g, "/");
    expr = expr.replace(/\s+/g, "");

    // strip trailing binary operators or trailing dot (but keep %)
    while (expr.length > 0 && /[+\-*/.]$/.test(expr)) expr = expr.slice(0, -1);
    if (!expr) return [];

    const tokens = [];
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];

      // numbers (may include decimal)
      if (/[0-9.]/.test(ch)) {
        let j = i;
        let num = "";
        while (j < expr.length && /[0-9.]/.test(expr[j])) {
          num += expr[j];
          j++;
        }
        if ((num.match(/\./g) || []).length > 1) throw new Error("Invalid number");
        tokens.push({ type: "number", value: parseFloat(num) });
        i = j - 1;
        continue;
      }

      // parentheses
      if (ch === "(" || ch === ")") {
        tokens.push({ type: "paren", value: ch });
        continue;
      }

      // percent (postfix)
      if (ch === "%") {
        tokens.push({ type: "percent", value: "%" });
        continue;
      }

      // operators and unary minus detection
      if (ch === "+" || ch === "*" || ch === "/") {
        tokens.push({ type: "operator", value: ch, prec: ch === "*" || ch === "/" ? 3 : 2, assoc: "left" });
        continue;
      }

      if (ch === "-") {
        const prev = tokens.length ? tokens[tokens.length - 1] : null;
        const prevIsValue = prev && (prev.type === "number" || prev.type === "percent" || (prev.type === "paren" && prev.value === ")"));
        if (!prev || !prevIsValue) {
          // unary minus
          tokens.push({ type: "unary", value: "u-", prec: 4, assoc: "right" });
        } else {
          tokens.push({ type: "operator", value: "-", prec: 2, assoc: "left" });
        }
        continue;
      }

      // any other char is invalid
      throw new Error("Invalid character: " + ch);
    }

    return tokens;
  }

  function tokensToRPN(tokens) {
    const output = [];
    const ops = [];

    for (const t of tokens) {
      if (t.type === "number") {
        output.push(t);
      } else if (t.type === "percent") {
        // postfix: directly push to output (applies to the previous value)
        output.push(t);
      } else if (t.type === "unary" || t.type === "operator") {
        while (ops.length > 0) {
          const o = ops[ops.length - 1];
          if (o.type === "paren" && o.value === "(") break;
          const oPrec = o.prec || 0;
          const tPrec = t.prec || 0;
          if (oPrec > tPrec || (oPrec === tPrec && t.assoc === "left")) {
            output.push(ops.pop());
          } else break;
        }
        ops.push(t);
      } else if (t.type === "paren" && t.value === "(") {
        ops.push(t);
      } else if (t.type === "paren" && t.value === ")") {
        let found = false;
        while (ops.length > 0) {
          const o = ops.pop();
          if (o.type === "paren" && o.value === "(") {
            found = true;
            break;
          }
          output.push(o);
        }
        if (!found) throw new Error("Mismatched parentheses");
      } else {
        throw new Error("Unknown token");
      }
    }

    while (ops.length > 0) {
      const o = ops.pop();
      if (o.type === "paren") throw new Error("Mismatched parentheses");
      output.push(o);
    }

    return output;
  }

  function evalRPN(rpn) {
    const stack = [];
    for (const t of rpn) {
      if (t.type === "number") stack.push(t.value);
      else if (t.type === "percent") {
        if (stack.length < 1) throw new Error("Invalid use of %");
        const a = stack.pop();
        stack.push(a / 100);
      } else if (t.type === "unary") {
        if (stack.length < 1) throw new Error("Invalid unary usage");
        const a = stack.pop();
        if (t.value === "u-") stack.push(-a);
        else throw new Error("Unknown unary");
      } else if (t.type === "operator") {
        if (stack.length < 2) throw new Error("Incomplete expression");
        const b = stack.pop();
        const a = stack.pop();
        let res;
        if (t.value === "+") res = a + b;
        else if (t.value === "-") res = a - b;
        else if (t.value === "*") res = a * b;
        else if (t.value === "/") {
          if (b === 0) throw new Error("Division by zero");
          res = a / b;
        } else throw new Error("Unknown operator");
        stack.push(res);
      } else {
        throw new Error("Unknown RPN token");
      }
    }

    if (stack.length !== 1) throw new Error("Invalid expression");
    return stack[0];
  }

  // -------------------------
  // compute wrapper
  // -------------------------
  function compute() {
    if (!expression) return;
    try {
      const tokens = tokenize(expression);
      if (tokens.length === 0) return;
      const rpn = tokensToRPN(tokens);
      const value = evalRPN(rpn);
      lastResult = value;
      expression = String(Number.isFinite(value) ? roundVal(value) : value);
      updateDisplay();
    } catch (err) {
      console.error(err);
      resultEl.textContent = "Error";
      setTimeout(() => {
        resultEl.textContent = expression || "0";
      }, 900);
    }
  }

  // -------------------------
  // UI helpers (press handlers)
  // -------------------------
  function pressNum(n) {
    if (expression === "0" && n === "0") return;
    if (expression === "0" && n !== ".") expression = n;
    else expression += n;
    updateDisplay();
  }

  function pressOp(op) {
    // allow unary minus at start
    if (!expression && op === "-") {
      expression = "-";
      updateDisplay();
      return;
    }
    // if empty and op isn't '-', ignore
    if (!expression) return;

    // replace last operator if there is one (so 5 + - -> 5 -)
    if (/[+\-*/×÷]$/.test(expression)) {
      expression = expression.slice(0, -1) + op;
    } else {
      expression += op;
    }
    updateDisplay();
  }

  function pressPercent() {
    const last = expression.slice(-1);
    // only allow % after a number or closing paren
    if (/[0-9)]/.test(last)) {
      expression += "%";
      updateDisplay();
    }
  }

  function clearAll() {
    expression = "";
    updateDisplay();
  }

  function del() {
    expression = expression.slice(0, -1);
    updateDisplay();
  }

  // -------------------------
  // DOM events
  // -------------------------
  keys.forEach((k) => {
    k.addEventListener("click", () => {
      const num = k.dataset.num;
      const act = k.dataset.action;
      if (num !== undefined) pressNum(num);
      else if (act === "op") pressOp(k.textContent.trim());
      else if (act === "clear") clearAll();
      else if (act === "del") del();
      else if (act === "equals") compute();
      else if (act === "percent") pressPercent();
    });
  });

  // keyboard support
  window.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") pressNum(e.key);
    else if (e.key === ".") pressNum(".");
    else if (e.key === "x" || e.key === "X" || e.key === "") pressOp("");
    else if (e.key === "/") pressOp("/");
    else if (e.key === "+" || e.key === "-") pressOp(e.key);
    else if (e.key === "Enter" || e.key === "=") {
      e.preventDefault();
      compute();
    } else if (e.key === "Backspace") del();
    else if (e.key === "Escape") clearAll();
    else if (e.key === "%") pressPercent();
  });

  // init
  clearAll();
})();