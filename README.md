# NavIn

NavIn is a boat logbook that installs on a phone as a web app (PWA). It is made for Lake Geneva and for the sea: large buttons, day and night modes, and it works without a network. All data stay on the phone.

> **Migration in progress.** The app is being rewritten from plain JavaScript to React. The original app is kept in [`legacy/`](legacy/) as the reference, and until the migration is finished some screens of the React version are incomplete. `legacy/` will be removed once the new version has been validated on the water.

## Start the app on your computer

You need [Node.js](https://nodejs.org/) 24 or later (it includes npm) and [Git](https://git-scm.com/). With [Volta](https://volta.sh/), `volta install node@24` installs Node.js and npm. All the commands below are typed in a terminal. To check that the tools are there, run `node -v`, `npm -v` and `git --version`: each one prints a version number.

The first time, go to the folder where you keep your projects, then download the code and install its dependencies. `npm run dev` starts the app. The next times, you only need to go to the `navin` folder and run `npm run dev`.

```sh
git clone https://github.com/Courtetelle/navin.git
cd navin
npm ci
npm run dev
```

Then open <http://localhost:11106/>. The page reloads by itself each time you save a file. Press `Ctrl+C` in the terminal to stop the server.

- `npm ci` installs exactly the versions listed in `package-lock.json`. Run it again after pulling changes that touch the dependencies.
- To add a package, use `npm install <package>` and commit `package-lock.json` with it.
- To open the app on a phone on the same Wi-Fi, run `npm run dev -- --host` and use the "Network" address it prints. The GPS will not work this way, because browsers only give the position to `https` pages.
- The service worker (offline mode) only runs in the production build: test it with `npm run build` then `npm run preview`.

## Everyday commands

| Command                                       | What it does                                                     |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                                 | Starts the development server on <http://localhost:11106/>       |
| `npm run build`                               | Builds the production site into `dist/`                          |
| `npm run preview`                             | Serves `dist/` on <http://localhost:11105/>                      |
| `npm run test`                                | Runs everything: tests with coverage, types, ESLint and Prettier |
| `npm run test-only`                           | Runs the tests with coverage                                     |
| `npm run check-types`                         | Checks the TypeScript types                                      |
| `npm run eslint` / `npm run eslint-fix`       | Checks the code / fixes what can be fixed automatically          |
| `npm run prettier` / `npm run prettier-write` | Checks the formatting / reformats the files                      |

To run some tests only, use `npx vitest run src/lib`. To re-run them on each change, use `npx vitest`.

Before each commit, run:

```sh
npm run eslint-fix
npm run prettier-write
npm run test
npm run build
```

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat: add the tide table`, `fix: keep the crew order`. They decide the next version number, so never edit `version` in `package.json` or `CHANGELOG.md` by hand.

## Save your work with Git and GitHub

Your changes first exist only on your computer. A **commit** records them in the history, on your computer. A **push** sends your commits to GitHub.

### Once per computer

You need a GitHub account with write access to `Courtetelle/navin`, and the [GitHub CLI](https://cli.github.com/). Tell Git who you are, using the email address of your GitHub account, then log in:

```sh
git config --global user.name "Jane Doe"
git config --global user.email "jane.doe@example.org"
gh auth login
```

`gh auth login` asks a few questions: choose GitHub.com, HTTPS, and logging in with a web browser.

### For each change

Work on a branch of your own: what lands on `main` is published.

```sh
git switch main
git pull                                 # gets the latest code
git switch -c fix-crew-order             # creates your branch

# edit the files and check the result with npm run dev

git status                               # lists what changed
git add .                                # selects all the changes
git commit -m "fix: keep the crew order" # records them on your computer
git push -u origin fix-crew-order        # sends them to GitHub
```

`git push` prints a link: open it to create a pull request. The tests run on it, and you can merge it on GitHub when they pass. To add more changes to the same branch, repeat `git add .`, `git commit -m "…"` and `git push`.

## Project layout

```
src/
  pages/<view>/        one folder per screen
  features/<domain>/   logic and components shared by several screens
  components/shared/   small reusable UI pieces
  shell/               top bar, navigation, toast, app start
  state/               global state (signals) and its actions
  storage/             localStorage and photo storage
  model/ lib/          static definitions and pure helpers
  i18n/                translations (French is the base language)
  serviceWorker/       offline support
  styles/              the stylesheet of the original app
public/                icons and web app manifests
scripts/parity/        compares the React app with legacy/
legacy/                the original app, read-only
```

## Where the data live

Everything is stored in the browser: `localStorage` keys starting with `ldb.`, and photos in the IndexedDB database `ldb-photos`. Each address has its own data, so `localhost` and the published site do not share anything. To move data from one to the other, use the backup and restore functions of the app.

## Compare with the original app

The parity check replays the same steps in both apps, with the same data and a frozen clock, then compares the page structure and the screenshots. It needs Google Chrome. Start the two servers, each in its own terminal, then run a scenario:

```sh
node scripts/parity/serve.ts legacy 4301
npx vite --port 4302 --strictPort
node scripts/parity/run.ts scripts/parity/scenarios/smoke.ts
```

The results are written to `parity-out/`.

## Develop remotely with Claude

Claude can work on this repository from a browser or a phone, with nothing installed on your computer. The session runs in the cloud on a copy of the GitHub repository, and the changes come back as a branch and a pull request.

You need a Claude plan that includes Claude Code (Pro, Max, Ultra or Team, or Enterprise with a Claude Code seat) and write access to `Courtetelle/navin`.

1. Open <https://claude.ai/code> and connect your GitHub account when asked.
2. Pick the repository `Courtetelle/navin` and the branch `main`.
3. Pick a permission mode: Auto, Accept edits or Plan.
4. Describe the task and press Enter. Start with "Run `npm ci`", so that the dependencies are installed.
5. When Claude has finished, read the changes and press **Create PR**. The tests run on the pull request, and merging it publishes the site.

On a phone, install the Claude app (iOS or Android), sign in with the same account and open the **Code** tab.

If Claude Code is installed in your terminal, you can start a cloud session from there, and bring it back to your computer afterwards:

```sh
git push                             # the session starts from what is on GitHub
claude --cloud "describe the task"   # starts a cloud session on the current branch
claude --teleport                    # continues a cloud session in your terminal
```

`--teleport` needs a clean Git state and a checkout of this repository.

To drive a session that runs on your own computer from a phone or a browser, use Remote Control instead. The code stays on your computer, which must stay on:

```sh
claude remote-control
```

Scan the QR code it shows, or open the session in the **Code** tab of <https://claude.ai/code> or of the Claude app.

Good to know about cloud sessions:

- They only see what is committed in the repository. Your personal `~/.claude` files (instructions, skills, settings) stay on your computer.
- They use Node.js 22 by default, not 24. The tests also run on Node.js 22 in CI.
- The parity check has not been tried there.

Documentation: [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web.md), [Remote Control](https://code.claude.com/docs/en/remote-control.md).

## Publish

Each push to `main` builds the site and publishes it on <https://courtetelle.github.io/navin/> (see [`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Tests, types and lint run on each push and pull request.

Two repository settings must be set once:

1. **Settings › Pages › Source**: choose "GitHub Actions".
2. **Settings › Actions › General**: enable "Allow GitHub Actions to create and approve pull requests", so that release-please can open its release pull requests. Merging one creates the version tag and updates [`CHANGELOG.md`](CHANGELOG.md).

### Configuration

| Repository variable | Purpose                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRACKING_SCRIPT`   | Optional audience measurement snippet, added at the end of `<head>` when the site is published. Unset means nothing is loaded. `npm run dev` never tracks. |

Set it in **Settings › Secrets and variables › Actions › Variables**.

## More documentation

- [User guide, in French](legacy/README.md)
- [Architecture of the original app, in French](legacy/ARCHITECTURE.md)
