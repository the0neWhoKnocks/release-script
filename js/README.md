# For Node Projects
---

## Pre-Install

**Prerequisites**:
- Your repo is already set up. The script keys off of info in your `package.json` and your `git` config.
- You have `curl` installed. Otherwise the install/update scripts can't download the release script files.
- If you want to publish releases:
   - On **GitHub**, you'll need to set up a [Personal Access Token](https://github.com/settings/tokens).
      - Click `Generate new token`
         - Regardless of what GitHub recommends, I set my token to never expire.
      - Add a name (Note) for the token
      - Check the `repo` checkmark. Top-level access isn't required for Public repos, but there may come a time that you want to release to a Private repo and you'll get blocked if you don't have a token with elevated privileges.
      - Copy the new token and run
         ```sh
         git config --global github.token <YOUR_TOKEN>
         ```
   - On **Gitea**, you'll need to set up an Access Token by going to `<DOMAIN>/user/settings/applications`.
      - In the **Manage Access Tokens** section, enter a name for your token and click `Generate Token`.
      - Copy the new token and run
         ```sh
         git config --global gitea.token <YOUR_TOKEN>
         ```

---

## Install

Available flags for the installer:
| Flag | Description |
| ---- | ----------- |
| `--force` | Force a fresh install, regardless of an existing install existing |
| `--install-dir` | If you want to install somewhere other than `./bin` |
| `--script-src` | Run the install from local files. Must pass an absolute path like `/<PATH>/js` |
| `--update` | Pulls in updates for the releaser script |

For a remote install, run:
```sh
# go into the repo you want to add releases for
cd <YOUR_REPO>

# install
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh)" # [optional flags]
```

To install from local files, run:
```sh
# go into the repo you want to add releases for
cd <YOUR_REPO>

# install
$HOME/some/path/js/tools/install.sh --script-src "$HOME/some/path/js"
```

---

## Run

```sh
./bin/release.js
# or
npm run release
# or
yarn release

# View all available flags by adding `--help` or `-h`
./bin/release.js -h
# or
npm run release -- -h
# or
yarn release -h
```

---

## Update

It's the same as the Install step, with an added flag

Run the below command
```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh) --update"

# If you had a custom install directory
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh) --update --install-dir \"some/other/folder\""

# or
npm run release:update
# or
yarn release:update
```
