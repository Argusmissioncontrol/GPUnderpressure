# GPUnder Pressure

> please be kind, my 3060 thanks you.

GPUnder Pressure is a private mobile client for a locally hosted image-generation setup.

The phone app provides a deliberately restricted remote interface while generation remains on the host machine through the existing Python application, ComfyUI, and local GPU.

## Remote controls

- Image generation
- Reference-image generation
- Prompt
- Safe preset aspect ratios
- Seed
- Reference image selection
- Generation status
- Result preview/save support

## Host-controlled settings

The remote client intentionally does not expose CFG, steps, batch size, sampler, scheduler, arbitrary resolutions, direct model selection, or raw ComfyUI access.

GPU-heavy settings remain controlled and validated by the host.

## Architecture

Phone app -> private network -> Python API -> ComfyUI -> local GPU

ComfyUI itself is never intended to be exposed directly to the public internet.

## Security direction

- Private-network access only
- No direct public ComfyUI access
- Server-side validation of every request
- Fixed safe generation settings
- Per-client and global queue limits
- Duplicate request protection
- No secrets committed to source control

## Status

Initial Expo / React Native mobile foundation.

Backend integration is intentionally not connected yet.
