/**
 * 測試專用 ESM loader：用 devDependency `typescript` 即時轉譯 .ts／.tsx，
 * 令 node:test 可以直接載入 React 元件（.tsx）同專案 TS 模組，唔使 build、唔加 runtime 依賴。
 * 只供本地測試用，production 行 Next.js 編譯，唔會經呢度。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const TS_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

export async function resolve(specifier, context, nextResolve) {
  // 專案沿用 bundler 寫法（相對 import 唔寫副檔名）；node ESM 要補返。
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parentFile = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    for (const ext of TS_EXTS) {
      const candidate = path.resolve(path.dirname(parentFile), specifier + ext);
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        isolatedModules: true,
        sourceMap: false,
      },
    });
    return { format: 'module', shortCircuit: true, source: outputText };
  }
  return nextLoad(url, context);
}
