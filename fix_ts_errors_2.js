const fs = require('fs');
const path = 'c:/cy-platform/backend/server.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix private members in MediasoupManager
content = content.replace(/private workers: mediasoup\.types\.Worker\[\] = \[\];/g, 'public workers: mediasoup.types.Worker[] = [];');
content = content.replace(/private routers: Map<string, mediasoup\.types\.Router> = new Map\(\);/g, 'public routers: Map<string, mediasoup.types.Router> = new Map();');
content = content.replace(/private transports: Map<string, mediasoup\.types\.WebRtcTransport> = new Map\(\);/g, 'public transports: Map<string, mediasoup.types.WebRtcTransport> = new Map();');
content = content.replace(/private producers: Map<string, mediasoup\.types\.Producer> = new Map\(\);/g, 'public producers: Map<string, mediasoup.types.Producer> = new Map();');
content = content.replace(/private consumers: Map<string, mediasoup\.types\.Consumer> = new Map\(\);/g, 'public consumers: Map<string, mediasoup.types.Consumer> = new Map();');

// Fix fetch response json type
content = content.replace(/const data = await response\.json\(\);/g, 'const data: any = await response.json();');

// Fix supabase streamData access
content = content.replace(/const \{ data: streamData, error \} = await supabase/g, 'const { data: streamData, error }: any = await supabase');

fs.writeFileSync(path, content);
console.log('Fixed more TypeScript errors');
