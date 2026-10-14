#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Locate ml/requirements.txt across potential root directory configurations
const reqCandidates = [
  path.resolve(__dirname, '../ml/requirements.txt'),
  path.resolve(__dirname, 'ml/requirements.txt'),
  path.resolve(process.cwd(), '../ml/requirements.txt'),
  path.resolve(process.cwd(), 'ml/requirements.txt'),
];

const reqPath = reqCandidates.find((p) => fs.existsSync(p));
if (!reqPath) {
  console.log('[setup_ml] ml/requirements.txt not found, skipping Python venv setup.');
  process.exit(0);
}

const mlDir = path.dirname(reqPath);
const venvDir = path.resolve(mlDir, '.venv');
const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.resolve(venvDir, 'Scripts/python.exe')
  : path.resolve(venvDir, 'bin/python');
const venvPip = isWin
  ? path.resolve(venvDir, 'Scripts/pip.exe')
  : path.resolve(venvDir, 'bin/pip');

console.log(`[setup_ml] Target virtualenv directory: ${venvDir}`);

// 2. Determine base system Python executable
let basePython = null;
const baseCandidates = isWin ? ['python', 'py', 'python3'] : ['python3', 'python'];
for (const cmd of baseCandidates) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    basePython = cmd;
    break;
  } catch (_) {}
}

if (!basePython) {
  console.warn('[setup_ml] No system Python found. Skipping ML virtualenv setup.');
  process.exit(0);
}

console.log(`[setup_ml] Using system Python: ${basePython}`);

// 3. Create .venv if it doesn't exist
if (!fs.existsSync(venvPython)) {
  console.log(`[setup_ml] Creating Python virtualenv at ${venvDir}...`);
  execSync(`${basePython} -m venv "${venvDir}"`, { stdio: 'inherit' });
} else {
  console.log(`[setup_ml] Python virtualenv exists at ${venvDir}.`);
}

// 4. Verify or install dependencies
try {
  execSync(`"${venvPython}" -c "import sklearn; import numpy"`, { stdio: 'ignore' });
  console.log('[setup_ml] scikit-learn and numpy are verified in virtualenv.');
} catch (_) {
  console.log(`[setup_ml] Installing packages from ${reqPath}...`);
  try {
    execSync(`"${venvPip}" install --upgrade pip`, { stdio: 'inherit' });
  } catch (_) {}
  execSync(`"${venvPip}" install -r "${reqPath}"`, { stdio: 'inherit' });
  console.log('[setup_ml] ML dependencies installed successfully.');
}
