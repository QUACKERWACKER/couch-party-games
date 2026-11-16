# Couch Party Games

Local multiplayer browser games for a shared screen. The launcher includes Blitz 7, Blitz Hoops, Blitz Track, Bedrock Rivals, and Ringout.

On macOS, open `Play.command` with Python 3 installed. Blitz Hoops uses Wi-Fi phone controllers for player input. Other games also accept keyboard input or standard gamepads. See [Joinstick.md](Joinstick.md) for browser-based phone controllers.

## Hosting

Enable GitHub Actions as the GitHub Pages publishing source. The workflow builds the games from an explicit list of browser assets. For a local static build, run `python3 build-site.py dist` with a fresh output directory.

To enable phone controllers on the hosted games, set the repository Actions variable `CONTROLLER_RELAY_ORIGIN` to the public HTTPS origin of a running Joinstick relay and rerun the workflow. The generated phone page uses the same domain and path prefix as the games. The relay runs separately and needs WebSocket support. The relay address is public.

For a Node hosting service, use `phone-controllers` as the root directory, `npm ci` as the build command, and `npm start` as the start command. The relay respects the service's `PORT` setting.

The generated game pages request that search engines omit them from results. Anyone with the address can open them.
