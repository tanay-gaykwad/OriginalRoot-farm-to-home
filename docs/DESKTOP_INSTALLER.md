# OriginalRoot Windows desktop installer

## Install

Download the current Windows x64 setup file from [GitHub Releases](https://github.com/tanay-gaykwad/originalroot-farm-to-home/releases), run it, and launch OriginalRoot from the Start menu or desktop shortcut. Docker and a separate Python installation are not required.

The first launch generates a random one-time setup key for the first owner account. Copy it from the startup prompt, open Operations, and use it to create the owner username and password. OriginalRoot removes the saved setup key after an owner account exists.

OriginalRoot runs its API on a loopback-only address. The desktop app stores the SQLite database, evidence images, and setup data in:

```text
%APPDATA%\OriginalRoot\data
```

When upgrading, close the previous app and make a backup first. OriginalRoot keeps its data in the current Windows user's app-data folder. Uninstalling OriginalRoot leaves that folder in place. Back it up before uninstalling or moving to another computer.

## Back up and restore

Close OriginalRoot first so SQLite can finish writing. Copy the entire `data` folder to encrypted, access-controlled storage. It contains account, customer, order, support, and evidence data. To restore, close OriginalRoot and replace the `data` folder with the trusted backup, then start the app again. Keep at least one copy outside this computer.

## Windows security

GitHub release installers are not code-signed because this project has no signing certificate. Windows may display an unknown-publisher or SmartScreen warning, and managed Windows devices may block unsigned applications. Do not bypass a device policy; use an appropriately signed release when signing is available.
