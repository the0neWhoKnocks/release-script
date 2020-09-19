#!/usr/bin/env node

const { readFileSync } = require('fs');
const { resolve } = require('path');

// Boilerplate =================================================================

const color = (() => {
  const tty = require('tty');
  const colorize = /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM) && tty.isatty(1);

  function CLIColor(str = '') {
    const RESET = colorize ? '\x1b[0m' : '';
    const api = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].reduce((obj, color, index) => {
      // foreground
      obj[color] = { get() { return CLIColor(colorize ? `${str}\x1b[${30 + index}m` : str); } };
      obj[`${color}Bright`] = { get() { return CLIColor(colorize ? `${str}\x1b[${90 + index}m` : str); } };
      // background
      obj[`bg${color[0].toUpperCase() + color.slice(1)}`] = { get() { return CLIColor(colorize ? `${str}\x1b[${40 + index}m` : str); } };
      obj[`bg${color[0].toUpperCase() + color.slice(1)}Bright`] = { get() { return CLIColor(colorize ? `${str}\x1b[${100 + index}m` : str); } };

      return obj;
    }, {});
    api.bold = { get() { return CLIColor(colorize ? `${str}\x1b[1m` : str); } };

    return Object.defineProperties(msg => `${str}${msg}${RESET}`, api);
  }
  return new CLIColor();
})();

function handleError(exitCode, errMsg) {
  if (exitCode > 0) {
    console.error(`\n${color.black.bgRed(' ERROR ')} ${color.red(errMsg)}`);
    process.exit(exitCode);
  }
}

const cmd = (cmd, { silent = true } = {}) => new Promise((resolve, reject) => {
  const { spawn } = require('child_process');
  const child = spawn('sh', ['-c', cmd]);
  let stdout = '';
  let stderr = '';
  
  child.stdout.on('data', (data) => {
    const out = data.toString();
    if (!silent) process.stdout.write(out);
    stdout += out;
  });
  
  child.stderr.on('data', (data) => {
    const err = data.toString();
    if (!silent) process.stdout.write(err);
    stderr += err;
  });
  
  child.on('close', (statusCode) => {
    if (statusCode === 0) resolve(stdout);
    else reject(handleError(statusCode, `Command "${cmd}" failed\n${stderr}`));
  });
});

function renderHeader(prefix, msg) {
  const TERMINAL_WIDTH = process.stdout.columns;
  const PRINTED_PREFIX = ` ${prefix} `;
  
  console.log(
      `\n${color.blue(Array(PRINTED_PREFIX.length + 1).join('▄') + '╓' + Array(TERMINAL_WIDTH - PRINTED_PREFIX.length).join('─'))}`
    + `\n${color.black.bgBlue(PRINTED_PREFIX)}${color.blue('║')} ${color.blue(msg)}`
    + `\n${color.blue(Array(PRINTED_PREFIX.length + 1).join('▀') + '╚' + Array(TERMINAL_WIDTH - PRINTED_PREFIX.length).join('═'))}`
  );
}

const parseArgs = ({ desc, flags }) => {
  const SCRIPT_NAME = require('path').basename(__filename);
  const rawArgs = [...process.argv.slice(2)];
  const args = {};
  let currProp;
  
  flags.push({
    prop: 'help',
    flag: ['--help', '-h'],
    desc: 'Prints out script options and usage.',
  });
  
  while(rawArgs.length) {
    const currArg = rawArgs[0];
    
    if (/^--?/.test(currArg)) currProp = undefined;
    
    if (currProp) {
      args[currProp].push(currArg);
    }
    else {
      for (let i=0; i<flags.length; i++) {
        const { flag, prop } = flags[i];
        
        if (flag.includes(currArg)) {
          currProp = prop;
          args[currProp] = [];
          break;
        }
      }
    }
    
    rawArgs.splice(0, 1);
  }
  
  if (args.help) {
    const TERMINAL_WIDTH = process.stdout.columns;
    const FLAG_COLUMN_LENGTH = flags.reduce((length, { flag }) => Math.max(length, flag.join(', ').length + 1), 0);
    const MIN_DOTS = 2;
    const LEADING_SPACE = ' ';
    const DOTS = Array(FLAG_COLUMN_LENGTH + MIN_DOTS).join('.');
    const flagLines = flags.map(({ desc, flag }) => {
      const flagsStr = flag.join(', ');
      const dots = DOTS.substring(0, DOTS.length - flagsStr.length);
      const lines = [`${LEADING_SPACE}${flagsStr} ${dots}`];
      const descWords = desc.split(/\s/);
      let lineNdx = 0;
      
      descWords.forEach((word, ndx) => {
        let line = lines[lineNdx];
        if (((line + word).length + MIN_DOTS + LEADING_SPACE.length) > TERMINAL_WIDTH) {
          lineNdx++;
          lines.push(Array(FLAG_COLUMN_LENGTH + MIN_DOTS + LEADING_SPACE.length).join(' ') + ' ');
        }
        lines[lineNdx] += ` ${word}`;
      });
      
      return lines.join('\n');
    });
    const flagOptsStr = flags.map(({ flag }) => `[${flag.join(' | ')}]`);
    
    console.log(
        `\n${LEADING_SPACE}${desc}`
      + `\n\n${LEADING_SPACE}Usage: ${SCRIPT_NAME} ${flagOptsStr.join(' ')}`
      + `\n\n${flagLines.join('\n')}`
    );
    process.exit(0);
  }
  
  return args;
};

class CLISelect {
  static hideCursor() { process.stdout.write('\x1B[?25l'); }

  static showCursor() { process.stdout.write('\x1B[?25h'); }
  
  constructor({
    label = '',
    options = [],
    selectedMsg = 'You selected: %s',
  } = {}) {
    const badOpts = options.filter((opt) => opt.length < 2);
    
    if (!label.length) handleError(1, "You didn't provide a `label` for CLISelect");
    if (!options.length) handleError(1, "You didn't provide any `options` for CLISelect");
    if (badOpts.length) handleError(1, `These \`options\` for CLISelect are missing an answer:\n\n ${badOpts.join('\n ')}`);
    
    this.label = label;
    this.rawOptions = options;
    this.ICON__NOT_SELECTED = color.black.bold('■');
    this.ICON__SELECTED = color.blue.bold('■');
    this.rdl = require('readline');
    this.formattedOptions = [];
    this.selectedOptionNdx = 0;
    this.selectedMsg = selectedMsg;
    
    this.render();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    CLISelect.hideCursor();
    
    this.handleInputData = this.handleInputData.bind(this);
    process.stdin.on('data', this.handleInputData);
    
    return new Promise((resolve) => {
      this.resolveSelection = resolve;
    });
  }
  
  render() {
    if (this.msgLineCount) this.rdl.moveCursor(process.stdout, 0, -this.msgLineCount);
    
    this.rawOptions.forEach(([opt], ndx) => {
      this.formattedOptions[ndx] = (ndx === this.selectedOptionNdx)
        ? `${this.ICON__SELECTED} ${opt}`
        : `${this.ICON__NOT_SELECTED} ${opt}`;
    });
    
    const msg = `\n ${this.label}\n\n ${this.formattedOptions.join('\n ')}\n`;
    this.msgLineCount = msg.split('\n').length - 1;
    process.stdout.write(msg);
  }

  handleInputData(data) {
    switch (data) {
      case '\r':
      case '\n': return this.enter();
      case '\u0004': // Ctrl-d
      case '\u0003': // CTRL+C
        return this.reset(); 
      case '\u001b[A': return this.upArrow();
      case '\u001b[B': return this.downArrow();
    }
  }
  
  reset() {
    process.stdin.removeListener('data', this.handleInputData);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    CLISelect.showCursor();
    
    if (!this.selection) {
      this.resolveSelection();
      process.exit(0);
    }
  }

  enter() {
    this.selection = this.rawOptions[this.selectedOptionNdx][1];
    this.reset();
    console.log(`\n ${this.selectedMsg.replace('%s', color.blue.bold(this.selection))}\n`);
    this.resolveSelection(this.selection);
  }

  upArrow() {
    this.selectedOptionNdx = (this.selectedOptionNdx - 1 < 0)
      ? this.formattedOptions.length - 1
      : this.selectedOptionNdx - 1;
    this.render();
  }

  downArrow() {
    this.selectedOptionNdx = (this.selectedOptionNdx + 1 === this.formattedOptions.length)
      ? 0
      : this.selectedOptionNdx + 1;
    this.render();
  }
}

// Script specific =============================================================

(async function release() {
  const {
    APP__NAME,
    APP__TEST_URL,
    CMD__BUILD,
    CMD__COMPILE,
    CMD__START,
    PATH__CREDS__DOCKER,
    PATH__CREDS__NPM,
    PATH__REPO_ROOT,
  } = require('./release-config.js');
  const PACKAGE_JSON = require(`${PATH__REPO_ROOT}/package.json`);
  const args = parseArgs({
    desc: 'A zero dependency script to help you release/publish code.',
    flags: [
      {
        prop: 'dryRun',
        flag: ['--dry-run', '-dr'],
        desc: "Prints out everything that'll happen. Won't actually deploy any code.",
      },
    ],
  });

  // Get current version number
  const CURRENT_VERSION = PACKAGE_JSON.version;
  const REPO_URL = (await cmd('git config --get remote.origin.url'))
    .replace(/^git@/, 'https://')
    .replace('.com:', '.com/')
    .replace(/\.git$/, '');
  // Build out what the version would be based on what the user chooses
  const VERSION_NUMS = CURRENT_VERSION.split('.');
  const MAJOR = `${+VERSION_NUMS[0] + 1}.0.0`;
  const MINOR = `${VERSION_NUMS[0]}.${+VERSION_NUMS[1] + 1}.0`;
  const PATCH = `${VERSION_NUMS[0]}.${VERSION_NUMS[1]}.${+VERSION_NUMS[2] + 1}`;

  renderHeader('BUMP', 'versions');
  const NEW_VERSION = await new CLISelect({
    label: 'Choose version:',
    options: [
      [`${color.green(PATCH)} ${color.black.bold('[Patch]')}`, PATCH],
      [`${color.yellow(MINOR)} ${color.black.bold('[Minor]')}`, MINOR],
      [`${color.red(MAJOR)} ${color.black.bold('[Major]')}`, MAJOR],
    ],
    selectedMsg: 'Bumping version to: %s',
  });

  // Ensure tags are up to date
  renderHeader('FETCH', 'tags');
  await cmd('git fetch --tags', { silent: false });
  
  // Get previous tag info so that the changelog can be updated.
  let latestTag;
  if (await cmd('git tag -l')) {
    renderHeader('GET', 'latest tag');
    latestTag = await cmd('git tag -l | tail -n1');
    console.log(`\n Latest tag: ${color.blue.bold(latestTag)}`);
  }

  // Run tests if they exist
  const HAS_TEST_SCRIPT = PACKAGE_JSON.scripts && PACKAGE_JSON.scripts.test;
  if (HAS_TEST_SCRIPT) {
    renderHeader('RUN', 'tests');
    const testCmd = `cd ${PATH__REPO_ROOT} && npm test`;
    (args.dryRun)
      ? console.log(`\n ${color.black.bgYellow(' DRYRUN ')} ${color.blue.bold(testCmd)}`)
      : await cmd(testCmd, { silent: false });
  }
  
  //   # get a list of changes between tags
  //   if [[ "$latestTag" != "" ]]; then
  //     filename="./CHANGELOG.md"
  //     newContent=""
  //     touch "$filename"
  // 
  //     #changes=$(git log "v3.1.0".."v4.0.0" --oneline)
  //     changes=$(git log "$latestTag"..HEAD --oneline)
  //     formattedChanges=""
  //     while read -r line; do
  //       escapedLine=$(echo "$line" | sed "s/\x27/_SQ_/g")
  // 
  //       if [[ "$formattedChanges" != "" ]]; then
  //         formattedChanges="$formattedChanges,'$escapedLine'"
  //       else
  //         formattedChanges="'$escapedLine'"
  //       fi
  //     done < <(echo -e "$changes")
  //     formattedChanges="[$formattedChanges]"
  // 
  //     newContent=$(node -pe "
  //       const categories = {
  //         'Bugfixes': [],
  //         'Dev-Ops': [],
  //         'Features': [],
  //         'Misc. Tasks': [],
  //         'Uncategorized': [],
  //       };
  // 
  //       $formattedChanges
  //         .map(change => {
  //           return change
  //             .replace(/^([a-z0-9]+)\s/i, \"- [\$1]($REPO_URL/commit/\$1) \")
  //             .replace(/_SQ_/g, \"'\");
  //         })
  //         .forEach(change => {
  //           if (change.includes(' fix: ')) categories['Bugfixes'].push(change.replace(' fix:', ' -'));
  //           else if (change.includes(' ops: ')) categories['Dev-Ops'].push(change.replace(' ops:', ' -'));
  //           else if (change.includes(' feat: ')) categories['Features'].push(change.replace(' feat:', ' -'));
  //           else if (change.includes(' chore: ')) categories['Misc. Tasks'].push(change.replace(' chore:', ' -'));
  //           else categories['Uncategorized'].push(change);
  //         });
  // 
  //         Object.keys(categories)
  //           .map(category => {
  //             const categoryItems = categories[category];
  //             return (categoryItems.length)
  //               ? \`**\${category}**\n\${categoryItems.join('\n')}\`
  //               : null;
  //           })
  //           .filter(category => !!category)
  //           .join('\n\n');
  //     ")
  //     handleError $? "Couldn't parse commit messages"
  // 
  //     # add changes to top of logs
  //     originalLog=$(cat "$filename")
  //     if [[ "$newContent" != "" ]]; then
  //       changelog=""
  //       lineNum=0
  //       while read line; do
  //         if [ $lineNum != 0 ]; then changelog+=$'\n'; fi;
  // 
  //         changelog+="$line"
  //         lineNum+=1
  // 
  //         # find the line just under the header text
  //         if [ "$changelog" = "# Changelog"$'\n'"---" ]; then
  //           # append the new changes
  //           change=$'\n'"## v$newVersion"$'\n\n'"$newContent"
  //           changelog="$changelog"$'\n'"$change"$'\n\n'"---"
  //         fi;
  //       done < $filename
  // 
  //       echo "$changelog" > "$filename"
  //     fi
  //   fi
  // 
  //   npm version --no-git-tag-version $bump
  //   handleError $? "Couldn't bump version number."
  // 
  //   if [[ "$COMPILE_CMD" != "" ]]; then
  //     echo;
  //     echo "[ COMPILE ] code ========================="
  //     echo;
  //     $COMPILE_CMD
  //     handleError $? "Couldn't compile with new version."
  //   fi
  // 
  //   echo;
  //   echo "[ BUILD ] Docker Image ========================="
  //   echo;
  //   $BUILD_CMD
  //   handleError $? "Couldn't build Docker image"
  // 
  //   echo;
  //   echo "[ START ] Docker Image ========================="
  //   echo;
  //   # Run the new image
  //   $START_CMD
  //   handleError $? "Couldn't start Docker image"
  // 
  //   exec < /dev/tty
  //   echo;
  //   echo " Verify things are running properly at $APP_URL"
  //   echo;
  //   echo " (1) Continue"
  //   echo " (2) Abort"
  //   echo;
  // 
  //   read response
  // 
  //   case $response in
  //     1)
  //       continueRelease="true"
  //       ;;
  //   esac
  //   exec <&-
  // 
  //   # Stops the image and cleans things up
  //   docker-compose down
  // 
  //   if [[ "$continueRelease" != "" ]]; then
  //     LATEST_ID=$(docker images | grep -E "$DOCKER_USER/$APP_NAME.*latest" | awk '{print $3}')
  //     handleError $? "Couldn't get latest image id"
  // 
  //     versionString="v$newVersion"
  // 
  //     # log in (so the image can be pushed)
  //     docker login -u="$DOCKER_USER" -p="$DOCKER_PASS"
  //     handleError $? "Couldn't log in to Docker"
  //     # add and commit relevant changes
  //     git add CHANGELOG.md package.json package-lock.json
  //     git commit -m "Bump to $versionString"
  //     # tag all the things
  //     gitChangeLogMsg="## $versionString"$'\n\n'"$newContent"
  //     sanitizedGitChangeLogMsg=$(echo "$gitChangeLogMsg" | sed 's/"/\\"/g')
  //     git tag -a "$versionString" -m "$gitChangeLogMsg"
  //     docker tag "$LATEST_ID" "$DOCKER_USER/$APP_NAME:$versionString"
  //     handleError $? "Couldn't tag Docker image"
  //     # push up the tags
  //     git push --follow-tags
  //     docker push "$DOCKER_USER/$APP_NAME:$versionString"
  //     docker push "$DOCKER_USER/$APP_NAME:latest"
  //     # create an actual release
  //     ghToken=$(git config --global github.token)
  //     if [[ "$ghToken" != "" ]]; then
  //       echo;
  //       echo "[ CREATE ] GitHub Release ========================="
  //       echo;
  // 
  //       branch=$(git rev-parse --abbrev-ref HEAD)
  // 
  //       remoteOriginURL=$(git config --get remote.origin.url)
  //       regEx="^(https|git)(:\/\/|@)([^\/:]+)[\/:]([^\/:]+)\/(.+).git$"
  //       if [[ "$remoteOriginURL" =~ $regEx ]]; then
  //         user=${BASH_REMATCH[4]}
  //         repo=${BASH_REMATCH[5]}
  //       fi
  // 
  //       jsonPayload="{ \"tag_name\": \"$versionString\", \"target_commitish\": \"$branch\", \"name\": \"$versionString\", \"body\": \"$sanitizedGitChangeLogMsg\", \"draft\": false, \"prerelease\": false }"
  //       # encode newlines for JSON
  //       jsonPayload=$(echo "$jsonPayload" | sed -z 's/\n/\\n/g')
  //       # remove trailing newline
  //       jsonPayload=${jsonPayload%$'\\n'}
  // 
  //       releaseApiURL="https://api.github.com/repos/$user/$repo/releases"
  // 
  //       echo "  Payload: $jsonPayload"
  //       echo "  URL: \"$releaseApiURL\""
  // 
  //       # https://developer.github.com/v3/repos/releases/#create-a-release
  //       curl \
  //         -H "Content-Type: application/json" \
  //         -H "Authorization: token $ghToken" \
  //         -X POST \
  //         -d "$jsonPayload" \
  //         --silent --output /dev/null --show-error --fail \
  //         "$releaseApiURL"
  //       handleError $? "Couldn't promote tag to a release"
  //     else
  //       echo "[WARN] Skipping GH release creation: No GH token found";
  //     fi
  //   else
  //     # reset changelog
  //     echo "$originalLog" > "$filename"
  //     # reset version bump
  //     npm version --no-git-tag-version "$VERSION"
  //   fi
})();
