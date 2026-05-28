import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'activo-fijo', 'frontend');
const proc = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: true });
proc.on('exit', (code) => process.exit(code ?? 0));
