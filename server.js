import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/engine.js': ['engine.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
for(const name of await readdir(fileURLToPath(new URL('.',import.meta.url)))){
  if(/^[a-z0-9-]+\.(?:js|css|html)$/i.test(name)&&name!=='server.js')files['/'+name]=[name,name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'];
}
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  try {
    const file = files[req.url];
    if (!file || req.method !== 'GET') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
    res.end(await readFile(fileURLToPath(new URL(file[0], import.meta.url))));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.cause?.code === 'ECONNREFUSED' ? 'Ollama не запущена. Выполните ollama serve и загрузите модель.' : error.message }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Игра запущена: http://127.0.0.1:${port}`));
