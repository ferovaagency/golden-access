// Local-only preview of the standalone interface proposal.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, 'propuesta-interfaz.html'), 'utf8').replaceAll('../../public/brand/ferova-isotipo.png', '/brand/ferova-isotipo.png'));
  } else if (url.pathname === '/brand/ferova-isotipo.png') {
    res.setHeader('Content-Type', 'image/png');
    res.end(fs.readFileSync(path.join(root, 'public/brand/ferova-isotipo.png')));
  } else {
    res.writeHead(404); res.end('Not found');
  }
});
server.listen(4174, '127.0.0.1', () => console.log('Propuesta: http://127.0.0.1:4174/'));
