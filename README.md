# GPUnder Pressure

> please be kind, my 3060 thanks you.

GPUnder Pressure is a private Android client for remotely using a locally hosted image-generation setup.

The phone provides a deliberately restricted interface while all generation remains on the home PC through Local Gen Studio, ComfyUI, and the local GPU.

## Current status

The end-to-end mobile generation path is working.

Verified on a physical OPPO Find X3 Pro:

- Standalone Android release build
- No Metro dependency
- No USB connection required
- No ADB reverse required
- Works over home Wi-Fi
- Works over mobile data
- Tailscale provides the private network path
- Phone can submit a generation
- ComfyUI receives and executes the job
- Result returns to the phone
- Result can be saved to the Android gallery
- Output preview can be cleared from the app

Current mobile checkpoint:

`943e51b` - `feat: route mobile client through tailscale`

## Current generation support

### Working

- Image generation
- Prompt
- Aspect-ratio presets:
  - 1:1
  - 16:9
  - 4:3
  - 9:16
- Seed
- Generation status
- Result preview
- Save to Gallery
- Clear Output

### Not yet enabled remotely

Reference-image generation exists in the mobile UI/contract direction but is not currently accepted by the production remote API.

The current remote backend deliberately supports image generation only.

## Host-controlled settings

The mobile client intentionally does not expose:

- CFG
- Steps
- Batch size
- Sampler
- Scheduler
- Arbitrary dimensions
- Model/checkpoint selection
- Raw ComfyUI controls

Generation-heavy settings remain owned and validated by the desktop application.

## Architecture

Phone
-> Tailscale
-> Tailscale Serve
-> Local Gen Studio Python API
-> existing generation service
-> ComfyUI on localhost
-> local GPU
-> result returned to phone

ComfyUI itself is never exposed directly to the tailnet or public internet.

## Networking

The mobile client currently connects to:

`https://andromeda.tailbb20c1.ts.net`

Tailscale Serve proxies that private HTTPS endpoint to:

`http://127.0.0.1:8080`

ComfyUI remains local at:

`127.0.0.1:8188`

Android MagicDNS requires Tailscale DNS to be enabled.

During testing, Android Private DNS had been manually set to an ad-blocking DNS provider. That prevented MagicDNS resolution. Switching Android Private DNS to **Automatic** restored resolution of the Tailscale hostname.

## Security model

- Tailnet-only access
- No public Funnel
- No direct public ComfyUI exposure
- Python API is the sole remote gateway
- Tailscale Serve identity is required for remote access
- Server-side validation
- Fixed safe generation settings
- Queue controls
- Duplicate-request protection
- No secrets committed to source control

A localhost-only development identity exception exists on the desktop API for USB/local development. It does not remove the Tailscale identity requirement for remote requests.

## Output behavior

At present, generations requested from the phone are still retained in the normal PC output location as well as being returned to the phone.

The phone only saves a permanent local copy when **Save to Gallery** is pressed.

A future improvement may make mobile-originated PC outputs transient, but this is intentionally deferred because the current working generation pipeline is stable.

## Project direction

Immediate milestone achieved:

**Standalone phone -> mobile data/Tailscale -> home GPU -> completed image -> phone**

Future work can build on this stable checkpoint rather than changing the core remote path.
