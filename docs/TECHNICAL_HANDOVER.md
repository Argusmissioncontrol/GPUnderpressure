# GPUnder Pressure - Technical Handover

Date: 2026-08-27

## Current verified checkpoint

Mobile repository:
https://github.com/Argusmissioncontrol/GPUnderpressure

Branch:
main

Current verified commit:
943e51b

Commit:
feat: route mobile client through tailscale

Working tree was clean after the standalone release test.

Previous important checkpoint:
eeabc70 - feat: connect mobile generation flow and save output

## What is now proven working

The complete remote generation path has been verified on a physical Android phone.

Verified path:

Phone
-> Tailscale
-> Tailscale Serve
-> Local Gen Studio remote API
-> existing desktop generation service
-> ComfyUI
-> RTX 3060
-> generated PNG
-> Local Gen Studio API
-> Tailscale
-> phone

The following were explicitly tested:

- Physical OPPO Find X3 Pro
- Standalone Android release build
- App launches with USB disconnected
- No Metro server required
- No ADB reverse required
- Phone can generate while disconnected from USB
- Phone can generate over mobile data with Wi-Fi disabled
- ComfyUI receives the mobile-originated job
- GPU completes the generation
- Finished result appears correctly in the phone app
- Result can be saved to Android gallery
- Save button reports:
  Saving...
  Saved ?
- Output can be cleared with Clear Output
- Clear Output resets the preview state
- TypeScript compile passes with zero errors

This is no longer only a development-client proof.

A standalone release installation has been built, installed, launched, disconnected from USB, reopened normally, and used successfully for end-to-end generation.

## Mobile networking

Current API base URL:

https://andromeda.tailbb20c1.ts.net

Tailscale Serve status:

https://andromeda.tailbb20c1.ts.net
-> proxy http://127.0.0.1:8080

Also configured:

http://andromeda:8080
http://andromeda.tailbb20c1.ts.net:8080

-> proxy http://127.0.0.1:8080

The HTTPS hostname is the production mobile route.

Do not switch the app back to:

http://127.0.0.1:8080

That address was only used during USB development with:

adb reverse tcp:8080 tcp:8080

The API USB reverse has been deliberately removed and the mobile app now works without it.

## Important Android / Tailscale DNS discovery

Tailscale itself was configured correctly:

- MagicDNS enabled on the tailnet
- Use Tailscale DNS settings enabled on Android

However, Android Private DNS was manually configured to use a third-party ad-blocking DNS provider.

This prevented Android system resolution of:

andromeda.tailbb20c1.ts.net

Symptoms included:

adb shell ping andromeda.tailbb20c1.ts.net
-> unknown host

and:

adb shell ping andromeda
-> unknown host

Raw Tailscale IP connectivity still worked:

100.70.90.99

The phone could ping that IP successfully.

The fix was:

Android Private DNS
-> Automatic

After that change:

andromeda.tailbb20c1.ts.net
resolved correctly to:
100.70.90.99

Then the phone successfully reached:

https://andromeda.tailbb20c1.ts.net/api/v1/health

with:

HTTP/1.1 200 OK

and:

{"status":"ok","apiVersion":1,"capabilities":["image"]}

This was the key fix that enabled the real standalone remote path.

## Tailscale security state

Tailscale Serve is tailnet-only.

No Funnel is enabled.

ComfyUI is never remotely exposed.

ComfyUI remains on:

127.0.0.1:8188

The Local Gen Studio Python API remains the sole remote gateway.

Tailscale Serve injects remote identity.

The desktop API requires Tailscale identity for remote requests.

A localhost-only development identity exception exists for requests whose client address is:

127.0.0.1
or
::1

That exception exists only for local/USB development and does not weaken the remote Tailscale route.

## Desktop remote API

Desktop repository:

C:\AI\local-gen-studio

Relevant remote API implementation:

app\remote_api.py

Relevant API prefix:

/api/v1

Working endpoints:

GET /api/v1/health
POST /api/v1/generate
GET /api/v1/jobs/{job_id}
GET /api/v1/jobs/{job_id}/result

Health response:

{
  "status": "ok",
  "apiVersion": 1,
  "capabilities": ["image"]
}

Current production remote capability:

image

Reference-image mode is not currently accepted remotely.

## Important desktop fixes made during integration

### Remote API registration guard

Local Gen Studio originally failed to reopen correctly because remote middleware was being registered again after the NiceGUI/FastAPI app had already started.

The symptom was:

RuntimeError:
Cannot add middleware after application has started.

The root page could return HTTP 500 even though:

/api/v1/health

still returned 200.

The fix added a registration guard inside register_remote_api():

if getattr(app.state, "remote_api_registered", False):
    return

app.state.remote_api_registered = True

This prevents duplicate middleware registration during application reruns.

### Localhost development identity

The desktop remote API normally trusts only Tailscale Serve identity.

For USB/local development, tailscale_identity() was extended so requests originating strictly from:

127.0.0.1
::1

return the local identity:

local-usb-dev

Remote requests without Tailscale Serve identity still receive HTTP 403.

Do not broaden this localhost exception.

## Mobile app current implementation

Relevant files:

App.tsx
src/api/types.ts
src/api/client.ts
src/api/mockClient.ts
src/api/realClient.ts

Current real client:

src/api/realClient.ts

Current BASE_URL:

https://andromeda.tailbb20c1.ts.net

The real client:

1. POSTs to /api/v1/generate
2. receives jobId
3. polls /api/v1/jobs/{jobId}
4. waits until status becomes COMPLETED
5. exposes the result endpoint as resultUrl
6. maps completion into mobile status "finished"

Polling interval:

1000 ms

## Mobile request contract

Generation request currently contains:

requestId
generationType
prompt
aspectRatio
seed
referenceUri

Generation modes defined in the mobile type system:

image
reference

However, production remote backend currently supports image only.

Allowed aspect ratios:

1:1
16:9
4:3
9:16

Seed is sent as a string.

An empty seed is currently normalized by the mobile side to:

-1

## Mobile UI currently working

The phone supports:

- Image mode
- Reference mode UI direction
- Prompt entry
- Aspect-ratio selection
- Seed input
- Reference image picker
- Generate button
- Request-in-flight lock
- Generation status
- Result image preview
- Save to Gallery
- Clear Output

The current production backend rejects unsupported reference generation rather than silently accepting it.

## Save-to-gallery implementation

Installed native Expo packages:

expo-file-system
expo-media-library

Current imports use legacy compatibility entrypoints:

expo-file-system/legacy
expo-media-library/legacy

The app:

1. requests media-library permission
2. downloads the result URL into app cache
3. saves the downloaded PNG into the Android media library
4. shows Saving...
5. shows Saved ? after success

Failure handling resets the save state back to idle.

Permission denial also resets save state.

A new generation resets saveState to idle.

Clear Output:

- sets resultUri to null
- resets saveState to idle
- sets status to Output cleared.

## Generation error handling

handleGenerate() now uses:

try
catch
finally

This was important because previously a network/backend failure could leave:

requestInFlight = true

forever and permanently disable the Generate button until reload.

Current behavior:

Success:
status -> Ready

Failure:
status -> Generation failed.

Finally:
requestInFlight -> false

Stale text such as:

Ready · backend not connected
Request prepared · backend offline
TEMPORARY OFFLINE SIMULATION

was removed.

## Current output persistence behavior

Phone-originated jobs currently still create/retain the normal PNG on the desktop.

The result is also returned to the phone.

The phone does not create a permanent gallery copy unless the user presses:

Save to Gallery

A future improvement was discussed:

mobile-originated desktop output could be transient and automatically cleaned up after successful delivery.

This was explicitly deferred.

Do not change desktop persistence until intentionally revisiting that feature.

## One observed black-image incident

During mobile-data testing, one result appeared fully black in the phone preview and remained black when saved.

The PC output for that generation was correct.

Before that exact result URL could be independently tested in Chrome, its PC output file had been manually deleted, causing:

generated file is missing

A subsequent fresh mobile-data-only generation completed successfully and displayed correctly on the phone.

Because the issue did not reproduce, no transport/decoder fix was made.

If black-output behavior becomes reproducible, investigate:

- exact result URL while the PC file still exists
- browser display vs React Native Image display
- response headers
- file completion timing
- caching
- image decoding

Do not treat the one-off black image as a known persistent defect at this checkpoint.

## Build environment

Node:

v24.20.0

Java:

C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot

Android SDK:

%LOCALAPPDATA%\Android\Sdk

Useful PowerShell environment setup:

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;C:\Program Files\nodejs;$env:Path"

Physical Android device used during development:

OPPO Find X3 Pro
model CPH2173
ADB serial 5342f13a

## Development commands

Type check:

& "C:\Program Files\nodejs\npx.cmd" tsc --noEmit

Local Android development build:

npx expo run:android --device

ADB devices:

& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l

Metro USB reverse used during development:

adb reverse tcp:8081 tcp:8081

Old API USB reverse used during development:

adb reverse tcp:8080 tcp:8080

The API reverse is no longer required for production operation.

## Release build proof

Release build command used:

npx expo run:android --variant release --device

Expo displayed the physical phone selector:

CPH2173

The phone displayed a security-check prompt during installation.

The locally built app was not submitted for that optional security upload.

The release app installed and launched automatically.

After installation:

- USB was disconnected
- app was closed
- app was reopened from normal Android launcher
- generation was started
- ComfyUI received the request
- generation completed
- correct output returned to the phone

This verifies that the installed release is standalone.

## Repository history relevant to this milestone

8073715
feat: establish mobile generation client contract

eeabc70
feat: connect mobile generation flow and save output

943e51b
feat: route mobile client through tailscale

At the final verified checkpoint, local and remote main were synchronized after push.

## Known limitations / deferred work

### Reference image generation

The UI and mobile type direction exist, but remote backend support is not enabled.

Do not silently fake or route reference generation into normal image mode.

### PC output cleanup

Remote generations remain stored on the PC.

Transient mobile-only persistence is future work.

### API endpoint configuration

The Tailscale hostname is currently hard-coded in:

src/api/realClient.ts

Future improvement could move this into configuration/environment handling if needed.

For this personal-use app, hard-coding the private tailnet hostname is currently acceptable.

### Mobile request progress

The client currently polls job status but does not yet expose sophisticated live generation progress.

### Distribution

The release app is installed locally.

No Play Store publication/distribution work has been done as part of this milestone.

## Security invariants

Do not violate these without an explicit architecture decision:

- Never expose ComfyUI directly
- Never enable Tailscale Funnel for this app
- Keep remote access tailnet-only
- Keep generation settings host-owned
- Validate remote input server-side
- Preserve queue limits
- Preserve duplicate-request protection
- Do not accept unsupported generation modes silently
- Do not broaden localhost development identity beyond loopback
- Do not commit secrets

## Immediate next step

There is no urgent blocker.

The core mobile remote-generation milestone is complete.

The next work session should begin from:

943e51b

and choose one deliberate chapter rather than modifying the proven core path casually.

Good candidates:

1. Implement real reference-image generation end to end.
2. Improve mobile progress/status UX.
3. Investigate transient PC storage for phone-originated generations.
4. Move API endpoint into clean configuration.
5. Improve result viewing/full-screen image UX.
6. Add production polish/icon/versioning.
7. Add release/distribution workflow.

## Current definition of GIG

The current milestone is GIG:

- build works
- typecheck clean
- repository clean
- pushed to origin
- release installed
- USB-free operation verified
- mobile-data remote operation verified
- complete generated output returned to phone

Standalone remote GPU image generation is operational.
