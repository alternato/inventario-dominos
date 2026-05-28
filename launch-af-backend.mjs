import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'activo-fijo', 'backend');
const proc = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, PORT: '4001' } });
proc.on('exit', (code) => process.exit(code ?? 0));
