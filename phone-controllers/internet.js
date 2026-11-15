import {spawn} from 'node:child_process';
import {get} from 'node:https';
import {createInterface} from 'node:readline';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const launcher = fileURLToPath(new URL('../Play.command', import.meta.url));

async function probe(address, signal) {
  const url = new URL('/phone/qr.js', address);
  try {
    const response = await fetch(url, {signal});
    await response.body?.cancel();
    return response.ok && response.headers.get('content-type')?.startsWith('text/javascript');
  } catch (error) {
    if (error.cause?.code !== 'ENOTFOUND') throw error;
    // The game host may use a DNS resolver that filters temporary tunnel domains.
    const dnsUrl = new URL('https://cloudflare-dns.com/dns-query');
    dnsUrl.search = new URLSearchParams({name: url.hostname, type: 'A'});
    const dns = await fetch(dnsUrl, {headers: {accept: 'application/dns-json'}, signal});
    const records = await dns.json();
    const ip = records.Answer?.find(record => record.type === 1)?.data;
    if (!ip) throw error;
    return await new Promise((resolve, reject) => {
      get(url, {family: 4, signal, lookup: (_, options, callback) => {
        if (options.all) callback(null, [{address: ip, family: 4}]);
        else callback(null, ip, 4);
      }}, response => {
        response.resume();
        resolve(response.statusCode === 200 && response.headers['content-type']?.startsWith('text/javascript'));
      }).on('error', reject);
    });
  }
}

export async function openInternetGame(origin, noOpen) {
  const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', origin],
    {stdio: ['ignore', 'pipe', 'pipe']});
  const stopped = new AbortController();
  let game;
  const stop = () => {
    stopped.abort();
    game?.kill();
    tunnel.kill();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const tunnelExit = new Promise((_, reject) => {
    tunnel.once('error', error => reject(new Error(error.code === 'ENOENT'
      ? 'Install cloudflared to start an internet game. See Joinstick.md.' : error.message)));
    tunnel.once('exit', (code, reason) => reject(new Error(`Cloudflare Tunnel stopped (${reason ?? code}).`)));
  });
  const publicAddress = new Promise(resolve => {
    for (const stream of [tunnel.stdout, tunnel.stderr]) {
      createInterface({input: stream}).on('line', line => {
        const address = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i)?.[0];
        if (address) resolve(address);
        if (/\b(?:ERR|WRN)\b/.test(line)) console.error(line);
      });
    }
  });

  try {
    const deadline = AbortSignal.timeout(60_000);
    const startup = AbortSignal.any([deadline, stopped.signal]);
    let lastFailure = 'Cloudflare has not announced a public address.';
    const ready = async () => {
      const address = await publicAddress;
      console.log(`Checking the public relay at ${address}…`);
      while (!startup.aborted) {
        try {
          if (await probe(address, AbortSignal.any([startup, AbortSignal.timeout(4_000)]))) return address;
          lastFailure = 'The tunnel returned an unexpected phone relay response.';
        } catch (error) {
          lastFailure = error.cause?.message ?? error.message;
        }
        await delay(750, null, {signal: startup});
      }
    };
    const timeout = new Promise((_, reject) => startup.addEventListener('abort', () =>
      reject(new Error(`Could not reach the public phone relay within 60 seconds. ${lastFailure}`)), {once: true}));
    const address = await Promise.race([ready(), tunnelExit, timeout]);
    console.log(`Internet relay ready at ${address}`);
    game = spawn(launcher, ['--joinstick', origin, '--joinstick-public-url', address,
      '--port', '0', ...(noOpen ? ['--no-open'] : [])],
      {stdio: 'inherit'});
    await Promise.race([tunnelExit, new Promise((resolve, reject) => {
      game.once('error', reject);
      game.once('exit', code => {
        if (code) reject(new Error(`The game launcher exited with status ${code}.`));
        else resolve();
      });
    })]);
  } catch (error) {
    if (!stopped.signal.aborted) throw error;
  } finally {
    stopped.abort();
    game?.kill();
    tunnel.kill();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
