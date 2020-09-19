# For Node Projects
---

## Install

**IMPORTANT**: This script requires Node 12 or above.

TODO
  - add wget/curl script for initial "clone"
    - something like on-my-zsh `sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`
  - add script to pull based on version

- If you want it to be part of your `package.json` scripts, add a reference to
the script:
   ```json
   "release": "node ./bin/release.js",
   ```

## Run

```sh
./bin/release.js
# or
npm run release
# or
yarn release
```
