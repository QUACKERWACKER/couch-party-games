# Joinstick phone controllers

The Joinstick option works alongside Steam QR Controller, physical pads, and the built-in Blitz 7 Wi-Fi controller. Launch normally for the usual game screens.

## Same Wi-Fi

With Node.js 22 or newer and npm, install the phone relay once from the Couch Party Games folder, then start it:

```sh
npm install --prefix phone-controllers
npm start --prefix phone-controllers
```

Keep it running. In a second terminal, from the Couch Party Games folder:

```sh
./Play.command --joinstick http://127.0.0.1:3000
```

Open a game, choose **Phone controllers**, then **Start room**. Scan the QR code or open the invite on a phone on the same Wi-Fi. Tap the highlighted action to claim a seat. Close the panel to play. **Disconnect room** removes those phones from the game.

If the QR points at the wrong network interface, restart the relay with `npm start --prefix phone-controllers -- --public-url http://YOUR-MAC-LAN-IP:3000`. Allow Node to accept incoming connections if macOS prompts you.

## Controller layouts

- **Blitz 7** has an analog stick and buttons that change with your player's role and phase. Hold **Pass** to charge, then release to throw.
- **Blitz Hoops** has an analog stick and dedicated **Shoot**, **Turbo**, **Swipe**, and **Pass / call** buttons. Hold **Shoot** to charge, then release.
- **Blitz Track** has **Stride / join**, **Turbo**, **Dirty trick**, and **Event action** for jumps, baton passes, and aid cups.
- **Bedrock Rivals** has an analog stick, a dedicated **Jet** button, and separate controls for minion and upgrade selection. Hold the picker button and aim to choose.
- **Ringout** has independent movement and aiming sticks. Hold **Push** to charge it, aim with the right stick, then release.

## Internet invites

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) and make sure it is available in your terminal. On the Mac running the game, run:

```sh
npm run internet --prefix phone-controllers
```

This starts a temporary public HTTPS tunnel for the phone relay and opens the local game launcher. Keep the terminal open during play. In the game, select **Phone controllers → Start room**. Check that the panel says **Internet invite** and the link starts with `https://`. Share that link or scan its QR code. Restarting the command gives you a new link. Test it with Wi-Fi turned off on your phone.

If you already host a relay, forward HTTP routes and WebSocket upgrades to its port, and set `--public-url` or `PUBLIC_URL` to the public HTTPS origin. Then launch the games locally with your relay's address:

```sh
./Play.command --joinstick https://your-relay.example
```

Use a relay you control or trust because the launcher loads its Joinstick browser code. The game itself still runs on the host Mac. Remote phones get the controls, and players elsewhere need a separate view of the game. Stock Joinstick uses four-letter room codes, so use it for trusted playtests and add stronger room admission before offering a public service.

An existing stock Joinstick 0.2.0 relay still works with the generic D-pad layout. The current room limit is eight Joinstick phones, or six in Blitz Hoops. Physical and Steam QR Controller pads count toward each game's own seat limit.
