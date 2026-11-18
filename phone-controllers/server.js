import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {openInternetGame} from './internet.js';
import {maxPhoneConnections} from './room-capacity.js';

await import('./patch-joinstick.js');
const {attach} = await import('joinstick');

const {values: args} = parseArgs({options: {
  port: {type: 'string'},
  'public-url': {type: 'string'},
  'client-ip-header': {type: 'string'},
  internet: {type: 'boolean'},
  'no-open': {type: 'boolean'},
}});
const port = Number(args.port ?? (args.internet ? 0 : process.env.PORT ?? 3000));
const publicUrl = args['public-url'] ?? process.env.PUBLIC_URL;
const qrModule = `export const maxPhoneConnections = ${maxPhoneConnections};\n`
  + await readFile(new URL(import.meta.resolve('uqr')), 'utf8');
const bedrockPhone=await readFile(new URL('../Bedrock/phone-controller.js', import.meta.url));
const server = createServer((request, response) => {
  if(request.method==='GET' && request.url==='/Bedrock/phone-controller.js') {
    response.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Access-Control-Allow-Origin':'*'}).end(bedrockPhone);
    return;
  }
  if (request.method === 'GET' && request.url === '/phone/qr.js') {
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    }).end(qrModule);
    return;
  }
  response.writeHead(404).end('Not found');
});

const relay = attach(server, {
  static: fileURLToPath(new URL('./public/', import.meta.url)),
  publicUrl,
  clientIpHeader: args.internet ? 'cf-connecting-ip' : args['client-ip-header'] ?? process.env.CLIENT_IP_HEADER,
});

server.listen(port, args.internet ? '127.0.0.1' : undefined, async () => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`Couch Party phone relay listening on ${origin}`);
  if (args.internet) {
    try {
      await openInternetGame(origin, args['no-open']);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      relay.close();
      server.close();
    }
  }
});
