# Command-Line Options

Run `java -jar world-downloader.jar --help` to list these. In the
Docker web console, the same options appear as form fields.

```bash
java -jar world-downloader.jar --no-gui -s mc.example.com -o my_world -r 10
```

## Connection
| Flag | Alias | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--server` | `-s` | — | Remote server address (hostname or IP, **no port**). Required for `--no-gui`. |
| `--local-port` | `-l` | `25565` | Port the downloader's proxy listens on. Connect Minecraft here. |
| `--username` | `-u` | — | Your Minecraft username. |
| `--token` | `-t` | — | Minecraft access token (see Authentication). |
| `--microsoft-login` | | off | Sign in with Microsoft via the **headless device-code flow** (prints a one-time code to approve on another device). No browser or inbound port needed — ideal for Docker/headless. The session is cached so later launches are silent. |
| `--ms-auth-cache` | | `cache/ms-auth.json` | Path to the Microsoft device-code session cache (relative to the working dir, i.e. the mounted `/data` volume in Docker). |
| `--disable-srv-lookup` | | off | Disable resolving the true address via DNS SRV records. |

## World output
| Flag | Alias | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--output` | `-o` | `world` | Output directory. An existing world is updated/merged. |
| `--seed` | | `0` | Numeric level seed for the output world. |
| `--center-x` | | `0` | Offsets the world: this X is placed at origin (0,0). Rounded to 512. Requires `--center-z`. |
| `--center-z` | | `0` | Offsets the world: this Z is placed at origin (0,0). Rounded to 512. Requires `--center-x`. |
| `--disable-world-gen` | | off | Set world type to a superflat void to stop new chunks generating. |
| `--disable-chunk-saving` | | off | Don't write chunks to disk (debugging). |
| `--ignore-block-changes` | | off | Ignore changes to chunks after they are loaded. |

## Render distance & map
| Flag | Alias | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--extended-render-distance` | `-r` | `0` | Re-send downloaded chunks to the client to extend render distance. |
| `--extended-render-pace` | | `6` | Milliseconds between each re-sent chunk. Lower = faster but choppier; higher = smoother. `0` = as fast as possible. |
| `--render-players` | | off | Show other players on the overview map. |
| `--mark-new-chunks` | | off | Outline newly downloaded chunks in orange. |
| `--mark-old-chunks` | | on | Grey out old chunks on the map. |
| `--disable-mark-unsaved` | | off | Stop marking unsaved chunks in red. |
| `--draw-extended-chunks` | | off | Draw re-sent (extended) chunks on the map. |
| `--enable-cave-mode` | | off | Auto-switch to cave render mode when underground. |
| `--render-map` | | off* | Render the overview map to PNG tiles under `<output>/overview` (for the web console live map). *Auto-on in `--no-gui` mode.* |
| `--disable-map-render` | | off | Don't render the overview map to disk, even when headless. |
| `--modded-block-colors` | | on | Colour modded (non-`minecraft:`) blocks on the map from their mod-JAR textures. |
| `--disable-modded-block-colors` | | off | Turn off modded-block map colouring. |

## Auto-open containers
Automatically open nearby containers (one at a time, rate-limited) to record their contents as you move. **Experimental — may trip server anti-cheat.**

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--auto-open-containers` | off | Enable the auto-open sweep. |
| `--auto-open-reach` | `4.0` (fixed) | **Ignored.** Reach is fixed at the survival reach (4.0); the flag is accepted but does nothing. |
| `--auto-open-delay` | `400` | Minimum milliseconds between opens. Higher = safer. |
| `--auto-open-gamemodes` | `all` | Gamemodes the sweep runs in: `all`, or a comma list of `survival,creative,adventure,spectator`. |
| `--auto-open-allow-trapped-chests` | off | Trapped chests are **not** auto-opened by default (opening one emits a redstone pulse that can trip contraptions/alarms); pass this to auto-open them too. |
| `--auto-open-allow-chest-near-players` | off | By default chests/trapped chests/barrels/shulkers are **not** opened while another player is within the radius below; pass this to open them anyway. |
| `--auto-open-player-radius` | `100` | Radius (blocks) for the "another player nearby" check. |
| `--auto-open-log` | — | File for a human-readable list of captured items (blank = `auto-open-items.log` beside the world). |
| `--auto-open-state` | — | File recording which containers were already opened (blank = `auto-open-attempted.txt` beside the world). |
| `--container-message-format` | `{type} ({count}) - {x} {y} {z}` | Template for the saved-container action-bar message. Placeholders: `{type} {count} {x} {y} {z}`. |

## Chat auto-reply
When an incoming chat message's trigger-coloured text matches, send that message's reply-coloured text back to the server as **real** chat. **Experimental.**

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--auto-reply` | off | Enable chat auto-reply. |
| `--auto-reply-trigger` | — | Exact text that triggers a reply (required). |
| `--auto-reply-trigger-color` | `yellow` | Colour of the text that must match the trigger. |
| `--auto-reply-color` | `red` | Colour of the text sent back as the reply. |
| `--auto-reply-delay` | `1500` | Minimum milliseconds between replies (anti-spam). |

## Interface & misc
| Flag | Alias | Description |
| ---- | ----- | ----------- |
| `--no-gui` | | Run headless (no GUI). Requires `--server`. |
| `--gui-theme` | `dark` | JavaFX GUI theme: `dark`, `light`, or `contrast` (high contrast). Also switchable live from the settings GUI (Extras tab). |
| `--force-console` | | Never redirect console output to the GUI. |
| `--enable-voice-proxy` | | Proxy Simple Voice Chat / PlasmoVoice UDP through the downloader. |
| `--disable-messages` | | Disable various info messages (e.g. chest saving). |
| `--dev-mode` | | Enable developer mode. |
| `--clear-settings` | | Delete the saved `config.json` and exit. |
| `--help` | `-h` | Show the help message. |

## Examples
Headless download to a custom folder with extended render distance:
```bash
java -jar world-downloader.jar --no-gui -s mc.example.com -o survival -r 12
```
Offset the saved world so spawn-area coordinates `(1500, -200)` become `(0, 0)`:
```bash
java -jar world-downloader.jar --no-gui -s mc.example.com --center-x 1500 --center-z -200
```
Offline-mode server:
```bash
java -jar world-downloader.jar --no-gui -s 192.168.1.50 -u Steve
```
