#!/usr/bin/env node
/**
 * Next.js dev 서버를 띄우며, stdout/stderr에서 token= 값을 *** 로 마스킹합니다.
 * 반드시: pnpm run dev 로 실행 (next dev 직접 실행 시 마스킹 안 됨)
 */
import { spawn } from "child_process";

console.error("[dev] Token redaction enabled (token= → token=***)");

const child = spawn("pnpm", ["exec", "next", "dev"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
  env: { ...process.env },
});

function redactToken(s) {
  return s.replace(/token=[^&\s]+/gi, "token=***");
}

function createLineBuffer(write) {
  let buf = "";
  const fn = (chunk) => {
    buf += chunk;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      write(redactToken(line) + "\n");
    }
    fn.buf = buf;
  };
  fn.buf = "";
  return fn;
}

child.stdout.setEncoding("utf8");
const outBuf = createLineBuffer((s) => process.stdout.write(s));
child.stdout.on("data", outBuf);
child.stdout.on("end", () => {
  if (outBuf.buf) process.stdout.write(redactToken(outBuf.buf) + "\n");
});

child.stderr.setEncoding("utf8");
const errBuf = createLineBuffer((s) => process.stderr.write(s));
child.stderr.on("data", errBuf);
child.stderr.on("end", () => {
  if (errBuf.buf) process.stderr.write(redactToken(errBuf.buf) + "\n");
});

child.on("close", (code) => process.exit(code ?? 0));
