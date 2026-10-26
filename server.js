const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const rooms = new Map();
const peers = new Set();

function localIPv4Addresses() {
  const records = Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal);
  const privateAddress = address => /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address);
  return [...new Set(records.map(item => item.address).filter(privateAddress))];
}

function sendFrame(socket, data, opcode = 1) {
  if (socket.destroyed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let header;
  if (payload.length < 126) { header = Buffer.from([0x80 | opcode, payload.length]); }
  else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  socket.write(Buffer.concat([header, payload]));
}
function sendJSON(peer, value) { sendFrame(peer.socket, JSON.stringify(value)); }
function roomPeers(room) { return [...peers].filter(peer => peer.room === room); }
function broadcast(room, value, except) { for (const peer of roomPeers(room)) if (peer !== except) sendJSON(peer, value); }
function presenceFor(room) {
  const members = roomPeers(room);
  return { type: 'presence', count: members.filter(p => p.role === 'screen').length, players: members.filter(p => p.role === 'player').map(p => ({ id: p.playerId, name: p.playerName })) };
}
function updatePresence(room) { broadcast(room, presenceFor(room)); }
function stateForPeer(peer, payload) {
  const state = { ...payload };
  if (state.game === 'guess' && state.guessMode === 'circle') {
    const active = Array.isArray(state.circleCards) ? state.circleCards.find(p => p.id === state.activePlayerId) : null;
    if (peer.role === 'player') {
      const isActive = peer.playerId === state.activePlayerId;
      state.playerView = {
        id: peer.playerId, name: peer.playerName, active: isActive,
        activeName: active?.name || 'участник',
        word: isActive ? '' : (active?.word || ''), emoji: isActive ? '' : (active?.emoji || ''),
        image: isActive ? '' : (active?.image || ''), style: active?.style ?? 0,
        hint: isActive ? '' : (active?.hint || ''),
        round: state.round || 1
      };
    } else {
      state.revealed = false; state.word = ''; state.image = ''; state.emoji = '';
    }
    delete state.circleCards;
  }
  return state;
}
function sendRoomState(room, payload, except) {
  for (const peer of roomPeers(room)) if (peer !== except) sendJSON(peer, { type: 'state', payload: stateForPeer(peer, payload) });
}
function handleMessage(peer, message) {
  let data;
  try { data = JSON.parse(message); } catch { return; }
  if (data.type === 'join' && typeof data.room === 'string') {
    peer.room = data.room.slice(0, 24);
    peer.role = data.role === 'screen' ? 'screen' : data.role === 'player' ? 'player' : 'host';
    if (peer.role === 'player') {
      peer.playerId = String(data.playerId || crypto.randomUUID()).slice(0, 64);
      peer.playerName = String(data.name || 'Игрок').trim().slice(0, 24) || 'Игрок';
    }
    peers.add(peer);
    sendJSON(peer, { type: 'joined', room: peer.room, role: peer.role, playerId: peer.playerId || '', screenCount: roomPeers(peer.room).filter(p => p.role === 'screen').length });
    if (rooms.has(peer.room)) sendJSON(peer, { type: 'state', payload: stateForPeer(peer, rooms.get(peer.room)) });
    updatePresence(peer.room); return;
  }
  if (data.type === 'state' && peer.room && peer.role === 'host') {
    const payload = data.payload;
    if (payload && typeof payload === 'object') {
      const safe = JSON.stringify(payload).slice(0, 100000);
      try { const parsed = JSON.parse(safe); rooms.set(peer.room, parsed); sendRoomState(peer.room, parsed, peer); } catch {}
    }
  }
  if (data.type === 'player-action' && peer.room && peer.role === 'player') {
    const state = rooms.get(peer.room);
    if (state?.game === 'guess' && state.guessMode === 'circle' && state.activePlayerId === peer.playerId && ['solved','pass'].includes(data.action)) {
      for (const other of roomPeers(peer.room)) if (other.role === 'host') sendJSON(other, { type: 'player-action', action: data.action, playerId: peer.playerId, name: peer.playerName });
    }
  }
}
function detach(peer) { if (!peers.has(peer)) return; const room = peer.room; peers.delete(peer); if (room) updatePresence(room); }
function parseFrames(peer, chunk) {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);
  while (peer.buffer.length >= 2) {
    const first = peer.buffer[0], second = peer.buffer[1], opcode = first & 0x0f, masked = !!(second & 0x80);
    let length = second & 0x7f, offset = 2;
    if (length === 126) { if (peer.buffer.length < 4) return; length = peer.buffer.readUInt16BE(2); offset = 4; }
    else if (length === 127) { if (peer.buffer.length < 10) return; const big = peer.buffer.readBigUInt64BE(2); if (big > 1000000n) { peer.socket.destroy(); return; } length = Number(big); offset = 10; }
    const maskBytes = masked ? 4 : 0;
    if (peer.buffer.length < offset + maskBytes + length) return;
    let payload = peer.buffer.subarray(offset + maskBytes, offset + maskBytes + length);
    if (masked) { payload = Buffer.from(payload); const mask = peer.buffer.subarray(offset, offset + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]; }
    peer.buffer = peer.buffer.subarray(offset + maskBytes + length);
    if (opcode === 8) { sendFrame(peer.socket, Buffer.alloc(0), 8); peer.socket.end(); detach(peer); return; }
    if (opcode === 9) { sendFrame(peer.socket, payload, 10); continue; }
    if (opcode === 1) handleMessage(peer, payload.toString('utf8'));
  }
}
const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (req.method === 'GET' && pathname === '/api/network-info') {
    const body = JSON.stringify({ addresses: localIPv4Addresses(), port, protocol: 'http' });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.end(body);
  }
  if (req.method === 'GET' && pathname === '/api/qr.svg') {
    const text = requestUrl.searchParams.get('text') || '';
    let parsed;
    try { parsed = new URL(text); } catch { res.writeHead(400); return res.end('Invalid URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || text.length > 2048) { res.writeHead(400); return res.end('Invalid URL'); }
    return QRCode.toString(text, { type: 'svg', width: 220, margin: 2, errorCorrectionLevel: 'M' }, (error, svg) => {
      if (error) { res.writeHead(500); return res.end('Could not generate QR code'); }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(svg);
    });
  }
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  });
});
server.on('upgrade', (req, socket) => {
  if (req.url.split('?')[0] !== '/sync' || !req.headers['sec-websocket-key']) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const peer = { socket, room: null, role: null, buffer: Buffer.alloc(0) };
  socket.on('data', chunk => parseFrames(peer, chunk));
  socket.on('close', () => detach(peer)); socket.on('error', () => detach(peer));
});
server.listen(port, '0.0.0.0', () => console.log(`Winter games server listening on 0.0.0.0:${port}`));
