# For Node Projects
---

## Install

**Prerequisites**:
- Your repo is already set up. The script keys off of info in your `package.json`
and your git config.
- You have `curl` installed. Otherwise the install/update scripts can't download
the release script files. 
- If you want to push releases to GitHub, you'll need to set up a [Personal access token](https://github.com/settings/tokens)
   - Click `Generate new token`
   - Add a name (Note) for the token
   - Check the `repo` checkmark. Top-level access isn't required for Public repos,
   but there may come a time that you want to release to a Private repo and you'll
   get blocked if you don't have a token with elevated privileges.
   - Copy the new token and run
   ```sh
   git config --global github.token <YOUR_TOKEN>
   ```

Run the below command
```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh)"

# If you don't want to install to the default `./bin` folder
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh) --install-dir \"some/other/folder\""

# If you want to force an install
sh -c "$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh) --force"
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
