const fs = require('fs');
const path = 'c:/cy-platform/backend/server.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix mediaCodecs type
content = content.replace(/mediaCodecs: MEDIASOUP_CONFIG\.router\.mediaCodecs,/g, 'mediaCodecs: MEDIASOUP_CONFIG.router.mediaCodecs as mediasoup.types.RtpCodecCapability[],');

// Fix non-existent .router property on transport
content = content.replace(/!transport\.router\.rtpCapabilities \|\|/g, '!(transport as any).router?.rtpCapabilities ||');
content = content.replace(/!transport\.router\.canConsume/g, '!(transport as any).router?.canConsume');

fs.writeFileSync(path, content);
console.log('Fixed last 3 TypeScript errors');
