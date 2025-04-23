import { spawn } from 'child_process';
import path from 'path';

export default function startNgrok() {
    const ngrokPath = path.join(process.cwd(), 'web-server', 'ngrok.exe');
    const ngrokArgs = ['http', '--url=selected-leech-definitely.ngrok-free.app', '3000'];

    const ngrokProcess = spawn(ngrokPath, ngrokArgs);

    ngrokProcess.stdout.on('data', (data) => {
        console.log(`[ngrok]: ${data}`);
    });

    ngrokProcess.stderr.on('data', (data) => {
        console.error(`[ngrok ERROR]: ${data}`);
    });

    ngrokProcess.on('close', (code) => {
        console.log(`[ngrok] process exited with code ${code}`);
    });
}