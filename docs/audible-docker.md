# Audible import container verification

The Dockerfile uses `node:current-slim`. At build time it upgrades installed Debian packages, resolves the [latest Libation release](https://github.com/rmcrackan/Libation/releases/latest), selects its amd64 or arm64 Debian package, and verifies the download against the SHA256 digest in GitHub's release metadata. The upstream package bundles its .NET runtime; no separate Libation service is needed. The image selects the current Debian release's ICU and OpenSSL runtime packages and installs FFmpeg/FFprobe. External browser authentication does not require desktop GTK/WebKit packages. The package is extracted without executing its desktop installation scripts.

The image rebuilds node-pty against the container's Node version and removes its compiler dependencies afterward. Books continues to run as the `node` user. Mounted upload directories must permit UID 1000 to write, and `/tmp` must have enough free space for an audiobook and its conversion files. Keep temporary import directories out of library watcher paths and persistent credential backups.

Libation's Widevine mode retrieves device data from its upstream CDM service using signed Audible account requests. This needs network access and Android account registration. That data stays in the per-import temporary configuration, which Books removes when the session ends. If a preferred source fails, Books retries high-quality AAC and then a compatible non-Widevine source.

## Build and smoke check

Prepare the release output with the same steps used by `.github/actions/prepare-build`:

```sh
npm ci
npm run build
cp package-lock.json bin/package-lock.json
(cd bin && npm ci --omit=dev)
docker build --pull --no-cache -f Dockerfile -t books-audible:test .
docker run --rm --network none --entrypoint node books-audible:test /home/node/app/check-docker-runtime.ts
```

The smoke check verifies the installed Libation version against the version resolved during the build, starts external login through an actual PTY, creates a small M4B with the image's native FFmpeg, validates its packets with the image's native FFprobe, and checks non-root execution and writable temporary storage. `FFMPEG_PATH` and `FFPROBE_PATH` intentionally select Debian's `/usr/bin` binaries because the release artifact may have been prepared on another operating system or CPU architecture. The check uses an isolated temporary Libation configuration and removes it on completion. The release workflow runs it before publishing a candidate image. Its daily run detects base image changes, new Libation package digests, relevant container source changes, and Debian upgrades available to the **last published Books image**. It rebuilds and publishes only when one of these changes or a new application release requires it. A unique build argument refreshes the APT layer on every candidate build. Publishing uses an application release or the existing container workflow; manual dispatch is available for an immediate rebuild.

The production release image was built and smoke checked locally for Linux arm64 and Linux amd64 (the latter under emulation) in Docker. The running arm64 image also served the application root and returned HTTP 401 for an unauthenticated `/audible/status` request. The release workflow performs the same Libation and PTY smoke check before publishing.

For native macOS development, install Libation separately and point `LIBATION_CLI` to its CLI binary. If a node-pty launch reports `posix_spawnp failed`, check that its `prebuilds/darwin-*/spawn-helper` has execute permission after `npm install`. Container builds compile the Linux helper from source and run a PTY smoke check.

## Interactive acceptance

1. Start the image with a writable library mount and configure its upload destination in Books settings. Sign in to Books and open **Import Audible Books**.
2. Supply your Audible account identifier and marketplace. Open **Sign in with Amazon**, authenticate in the new tab, and paste the complete resulting address-bar URL back into Books, including when Amazon displays an error page.
3. Verify discovery includes a purchased book and an available Audible Plus book. Import a title, confirm progress and immediate library availability, then reopen or refresh the interface during another download to check reconnection.
4. Verify administrators receive the metadata editor and other users see book details without metadata editing controls. Both should retain their account-level reading status control. Check multiple completed books advance through the review queue while downloading continues.
5. Repeat an import and check existing ASINs are skipped. Rename or move an imported book, repeat the import, and check it is still skipped; delete it and verify it is eligible again.
6. Inspect an imported file with `ffprobe -v error -show_streams -show_chapters -of json /path/to/book.m4b`; confirm readable audio, chapters, cover art where available and the source codec. Preferred xHE-AAC availability depends on the title and marketplace; verify any fallback preserves the available source without lossy transcoding.
7. Cancel a download and try an abandoned authentication session. Confirm partial files never enter the library and temporary configuration, account/token files and staging downloads are removed after success, failure, cancellation and server restart. Check application logs and browser progress messages contain no reusable credentials or pasted redirect URLs.

Real Amazon authentication and source-format availability require an interactive account login and have not been verified by automated fixtures.
