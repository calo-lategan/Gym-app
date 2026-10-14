# Install Ironwyrm on your Android phone

You build the app once in Expo's cloud from your laptop, then install the file
it gives you on your phone. No Play Store needed. Plan for 30 to 60 minutes the
first time; most of it is waiting.

## What you need

- A Windows or Mac laptop with internet.
- Your Android phone.
- A free Expo account: sign up at https://expo.dev/signup and remember your
  username and password.

## Step 1. Install two free tools on the laptop

1. **Node.js:** go to https://nodejs.org, download the version marked **LTS**,
   run the installer and keep clicking Next until it finishes.
2. **Git:**
   - Windows: go to https://git-scm.com/download/win, download Git for
     Windows, run it and keep clicking Next (the defaults are fine).
   - Mac: skip this. The Mac offers to install it in step 3.

## Step 2. Open a terminal

The terminal is a window where you type commands.

- **Windows:** press the Start key, type `cmd` and open **Command Prompt**. Use
  Command Prompt, not PowerShell, because PowerShell blocks one of the tools.
- **Mac:** press Cmd and Space together, type `Terminal` and press Enter.

How to use it: copy one line from the boxes below, paste it into the terminal
(right-click or Ctrl+V on Windows, Cmd+V on Mac), press Enter, and wait until it
finishes and you can type again before you paste the next line.

If you installed Node.js or Git while the terminal was open, close it and open
a new one so it can find them.

## Step 3. Download the app's code

```
git clone --branch claude/gallant-feynman-ycxw6a https://github.com/calo-lategan/Gym-app.git
```

```
cd Gym-app
```

On a Mac, if a window asks to install the "command line developer tools", click
Install, wait for it to finish, then paste the first line again.

## Step 4. Install the app's building blocks

```
npm install
```

This takes a few minutes. Yellow warnings are normal.

## Step 5. Sign in to Expo

```
npx eas-cli@latest login
```

- If it asks `Ok to proceed? (y)`, type `y` and press Enter.
- Type your Expo username or email, then your password. The password stays
  invisible while you type. That is normal.

The code is already linked to your `ironwyrm` project on Expo, so there is
nothing else to set up.

## Step 6. Build the app

```
npx eas-cli@latest build --platform android --profile preview
```

- `Generate a new Android Keystore?` Type `y`. This is the app's signing key;
  Expo keeps it safe for you.
- If it asks any other yes or no question, press Enter to accept the default.

It then uploads the code and builds the app on Expo's computers. Free builds
first wait in a shared queue: anywhere from a few minutes to two hours, longest
during North American mornings. The build itself then takes about 15 to 25
minutes. You can close the terminal; the build keeps going. When it is done,
the terminal shows a QR code and a link, and the build page on expo.dev shows
an Install button (step 7).

## Step 7. Install it on your phone

1. Scan the QR code with your phone's camera. Or, on the phone, open
   https://expo.dev, sign in, then go to Projects, ironwyrm, Builds and tap the
   newest build.
2. Tap **Install** to download the file. It ends in `.apk`.
3. Open the file. If Android says your browser is not allowed to install apps,
   tap Settings, turn on **Allow from this source**, go back and tap Install.
4. If Play Protect warns that the app is unrecognised, tap **More details**,
   then **Install anyway**. It warns only because the app is not on the Play
   Store yet.
5. Open **Ironwyrm** from your apps. Allow notifications when it asks, so your
   gym reminders work.

## Getting newer versions

Most new versions reach your phone on their own, as over-the-air updates. Open
Ironwyrm and it downloads the update, then restarts itself a few seconds later.
It never restarts in the middle of a workout or before you finish setting up;
then the update waits for the next time you open the app.

Updates need a build from 14 October 2026 or later installed once, because
older builds do not have the updater.

### One time: let GitHub publish updates for you

Claude's changes are published as updates automatically once GitHub has a key
to your Expo account. You never share this key with anyone, Claude included.

1. On expo.dev, click your profile picture, then **Account settings**, then
   **Access tokens**. Create a token, name it `github`, and copy it.
2. On github.com, open the **Gym-app** repository, then **Settings**,
   **Secrets and variables**, **Actions**, and **New repository secret**.
   Name it `EXPO_TOKEN`, paste the token as the secret and save.

From then on, every change Claude pushes that passes the tests becomes an
update a few minutes later.

### Publishing an update from the laptop instead

Open a terminal in the `Gym-app` folder and run these one at a time:

```
git fetch
```

```
git reset --hard origin/claude/gallant-feynman-ycxw6a
```

```
npm install
```

```
npx eas-cli@latest update --branch preview --platform android --message "Latest version"
```

The second line makes your copy exactly match the latest code and drops any
changes the tools made to it. Your hero and progress live on the phone, so
nothing of yours is lost. Updates skip the build queue, so this takes a minute
or two.

### When a new build is needed

Some changes cannot travel as an update, such as a new phone feature that needs
native code. Claude will tell you when that happens. Then run the first three
lines above, then the build command from step 6, and install the new build like
step 7. It replaces the old app and keeps your hero, history and records.

You can also start that build from your phone: on expo.dev, open Projects,
ironwyrm, then Project settings, GitHub, and connect the **Gym-app** repository
(one time, leave the folder as `/`). After that, open Builds, tap **Build from
GitHub**, choose the branch `claude/gallant-feynman-ycxw6a`, platform
**Android** and profile **preview**, and start it.

## If something goes wrong

- **`'git'`, `'npm'` or `'npx'` is not recognized:** close the terminal and
  open a new one. If it still happens, run the Node.js or Git installer again.
- **"running scripts is disabled on this system":** you are in PowerShell.
  Open Command Prompt instead (step 2).
- **The build fails:** open the build link, scroll to the red error message,
  copy it and send it to Claude.
- **Your phone refuses apps from unverified developers** (a newer Android rule
  in some countries): send a message and we will use another way to install.
