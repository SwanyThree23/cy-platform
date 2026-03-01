const fs = require('fs');
const path = 'c:/cy-platform/backend/server.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix PORT to number
content = content.replace(/const PORT = process\.env\.PORT \|\| 3001;/g, 'const PORT = Number(process.env.PORT) || 3001;');

// Fix catch blocks
content = content.replace(/catch \(error\) \{/g, 'catch (error: any) {');

// Fix mediasoup createWorker
content = content.replace(/mediasoup\.createWorker\(MEDIASOUP_CONFIG\.worker\)/g, 'mediasoup.createWorker(MEDIASOUP_CONFIG.worker as mediasoup.types.WorkerSettings)');

fs.writeFileSync(path, content);
console.log('Fixed TypeScript errors');
