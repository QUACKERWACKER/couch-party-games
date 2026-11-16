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
- **Blitz Hoops** shows the controls for your current job, including team selection, the CPU draft, **Shoot**, **Pass**, **Call for pass**, **Block**, and **Steal**. Hold **Shoot** while moving, then release to shoot. For free throws, watch the shared meter and tap **Free throw** in the green. Reconnecting during a match returns you to the same player. The CPU covers your spot while you’re away.
- **Blitz Track** shows **Join** in the lobby and gives team captains **Choose athlete** at the event desk. During a race it shows **Stride**, **Turbo**, **Dirty trick**, and the current event action, such as **Pass baton** or **Hold Splash**. Field events label the main button for the current meter. Watch the shared screen for GO and the green zones. A CPU covers a disconnected runner until their phone rejoins.
- **Bedrock Rivals** jets when you push the stick up. Hold **Dig** or **Fire** while steering. Tap **Pick minion** or **Pick upgrade** for a quick choice on the phone, then **Summon** or **Upgrade** to spend ore. In the lobby, the host can change the match size or start the round.
- **Ringout** has independent movement and aiming sticks. Tap **Join** to claim a fighter, then **Ready** after customizing. Hold **Push** to charge it while moving and aiming, then release. Between rounds, browse with Move and tap **Pick** when your choice appears. The shared screen still shows every option.

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

The project's relay accepts up to 16 phone connections per room. The games decide how many players can take a seat. Physical and Steam QR Controller pads count toward each game's own seat limit. A stock Joinstick 0.2.0 relay still works with its original limits and generic D-pad layout.
