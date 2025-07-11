#!/usr/bin/env node

const { access, lstat, readFile, writeFile } = require('node:fs/promises');

// Boilerplate =================================================================

const color = (() => {
  const tty = require('node:tty');
  const colorize = /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM) && tty.isatty(1);

  function CLIColor(str = '') {
    const CSI = '\x1b['; // Control Sequence Introducer, read more: https://notes.burke.libbey.me/ansi-escape-codes/#:~:text=ANSI%20escapes%20always%20start%20with,and%20this%20is%20basically%20why.
    const RESET = colorize ? `${CSI}0m` : '';
    const api = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].reduce((obj, color, index) => {
      // foreground
      obj[color] = { get() { return CLIColor(colorize ? `${str}${CSI}${30 + index}m` : str); } };
      obj[`${color}Bright`] = { get() { return CLIColor(colorize ? `${str}${CSI}${90 + index}m` : str); } };
      // background
      obj[`bg${color[0].toUpperCase() + color.slice(1)}`] = { get() { return CLIColor(colorize ? `${str}${CSI}${40 + index}m` : str); } };
      obj[`bg${color[0].toUpperCase() + color.slice(1)}Bright`] = { get() { return CLIColor(colorize ? `${str}${CSI}${100 + index}m` : str); } };

      return obj;
    }, {});
    api.bold = { get() { return CLIColor(colorize ? `${str}${CSI}1m` : str); } };
    api.italic = { get() { return CLIColor(colorize ? `${str}${CSI}3m` : str); } };
    api.underline = { get() { return CLIColor(colorize ? `${str}${CSI}4m` : str); } };

    return Object.defineProperties(msg => `${str}${msg}${RESET}`, api);
  }
  return new CLIColor();
})();

function handleError(exitCode, errMsg) {
  if (exitCode > 0) {
    console.error(`\n ${color.black.bgRed(' ERROR ')} ${color.red(errMsg)}`);
    process.exit(exitCode);
  }
}

const cmd = (cmd, { cwd, onError, silent = true } = {}) => new Promise((resolve, reject) => {
  const { spawn } = require('node:child_process');
  const opts = { cwd };
  const child = spawn('sh', ['-c', cmd], opts);
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
  
  child.on('close', async (statusCode) => {
    if (statusCode === 0) resolve(
      stdout
        .split('\n')
        .filter(line => !!line.trim())
        .join('\n')
    );
    else {
      if (onError) {
        if (onError.constructor.name === 'AsyncFunction') await onError(stderr);
        else onError(stderr);
      }
      
      const errMsg = `Command "${cmd}" failed\n${stderr}`;
      reject(errMsg);
      handleError(statusCode, errMsg);
    }
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
  const SCRIPT_NAME = require('node:path').basename(__filename);
  const rawArgs = [...process.argv.slice(2)];
  const args = {};
  let currProp;
  
  flags.push({
    prop: 'help',
    flag: ['--help', '-h'],
    desc: 'Prints out script options and usage.',
  });
  
  while (rawArgs.length) {
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
      
      descWords.forEach((word) => {
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
    this.rdl = require('node:readline');
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
    
    if (this.selection === undefined) {
      this.resolveSelection();
      process.exit(0);
    }
  }

  enter() {
    this.selection = this.rawOptions[this.selectedOptionNdx][1];
    this.reset();
    if (this.selectedMsg) console.log(`\n ${this.selectedMsg.replace('%s', color.blue.bold(this.selection))}\n`);
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
const PATH__REPO_ROOT = process.env.PWD;
const PATH__REPO_CONFIG = `${PATH__REPO_ROOT}/release-config.js`;
const PATH__SCRIPT = __dirname;
const SYMBOL__CHECK = '\u2714';
const SYMBOL__INFO = '\u2139';
const SYMBOL__X = '\u2716';
const {
  _defaultDockerRegistry,
  _defaultRepoAPIURL,
  _supportedRepos,
  ...schema
} = require(`${PATH__SCRIPT}/schema.json`);
const args = parseArgs({
  desc: 'A script to help you release/publish code.',
  flags: [
    {
      prop: 'dryRun',
      flag: ['--dry-run', '-dr'],
      desc: "Prints out everything that'll happen. Won't actually deploy any code.",
    },
    {
      prop: 'genConfig',
      flag: ['--generate-config', '-gc'],
      desc: "Generates a release config in the repo.",
    },
    {
      prop: 'showCreds',
      flag: ['--show-credentials', '-sc'],
      desc: "Prints credentials, despite being run with --dry-run.",
    },
    {
      prop: 'updateConfig',
      flag: ['--update-config', '-uc'],
      desc: "Update an old config.",
    },
  ],
});

const fileExists = async (path) => {
  try { await access(path); return true; }
  catch { return false; }
};

const genConfig = async ({
  top = 'module.exports = {',
  bottom = '};\n',
  updating,
} = {}) => {
  let config = Object.entries(schema).reduce((arr, [ key, keyData ]) => {
    const { desc } = keyData; 
    const { value } = (updating) ? updating[key] || keyData : keyData; 
    
    if (desc) {
      let line = `// ${desc}`;
      if (key === 'REPO__HOST') line += ` (Supported: ${_supportedRepos.join(', ')})`;
      else if (key === 'DOCKER__REGISTRY_DOMAIN') line = line.replace('$DEFAULT_REGISTRY', _defaultDockerRegistry);
      arr.push(line);
    }
    
    const wrapVal = (typeof value === 'string' && !/^['"`]/.test(value));
    arr.push(`${key}: ${(wrapVal) ? `'${value}'` : value},`);
    
    return arr;
  }, []);
  config = [
    top,
    ...config.map((line) => `  ${line}`),
    bottom,
  ];
  
  if (args.dryRun) {
    console.log(`\n${config.join('\n')}`);
  }
  else {
    await writeFile(PATH__REPO_CONFIG, config.join('\n'), 'utf8');
  }
};

(async function release() {
  // Verify the config exists ==================================================
  if (args.genConfig) {
    await genConfig();
    console.log(`\n ${color.green(SYMBOL__CHECK)} Config generated.\n ${color.yellow(SYMBOL__INFO)} Update the config with your repo-specific values, and re-run: ${color.cyan('release')}`);
    process.exit(0);
  }
  else if (!(await fileExists(PATH__REPO_CONFIG))) {
    handleError(1, `No config detected for repo path "${PATH__REPO_ROOT}".\n\n Run: ${color.cyan('release --generate-config')}`);
  }
  
  // Update config =============================================================
  if (args.updateConfig) {
    const oldConfig = await readFile(PATH__REPO_CONFIG, 'utf8');
    const parts = oldConfig.split('\n').reduce((obj, line) => {
      const { top, middle, bottom } = obj;
      
      if (!obj.section) {
        top.push(line);
        if (/^module\.exports/.test(line)) { obj.section = 'middle'; }
      }
      else if (obj.section === 'middle') {
        if (/^};/.test(line)) {
          obj.section = 'bottom';
          bottom.push(line);
        }
        else { middle.push(line); }
      }
      else {
        bottom.push(line);
      }
      
      return obj;
    }, { top: [], middle: [], bottom: [] });
    const parsed = parts.middle.reduce((obj, line, ndx) => {
      line = line.trim().replace(/,$/, '');
      
      if (line.startsWith('// ')) obj.comments[ndx] = line;
      else {
        const [ key, ...val ] = line.split(': ');
        obj[key] = { desc: obj.comments[ndx - 1], value: val.join(': ') };
      }
      
      return obj;
    }, { comments: [] });
    
    await genConfig({
      top: parts.top.join('\n'),
      bottom: parts.bottom.join('\n'),
      updating: parsed,
    });
    
    console.log(`\n ${color.green(SYMBOL__CHECK)} Config updated.\n ${color.yellow(SYMBOL__INFO)} Review the config to ensure entegrity, then re-run: ${color.cyan('release')}`);
    process.exit(0);
  }
  
  // Begin sanity checks =======================================================
  console.log('\n Sanity checks:');
  
  // Verify the config's schema ================================================
  const config = require(PATH__REPO_CONFIG);
  let {
    version: configVersion,
    APP__TEST_URL,
    CMD__DOCKER_BUILD,
    CMD__DOCKER_START,
    CMD__COMPILE_ASSETS,
    DOCKER__IMG_NAME,
    DOCKER__REGISTRY_DOMAIN,
    REPO__API_URL,
    REPO__HOST,
  } = config;
  
  if (!DOCKER__REGISTRY_DOMAIN) DOCKER__REGISTRY_DOMAIN = _defaultDockerRegistry;
  if (!REPO__API_URL) REPO__API_URL = _defaultRepoAPIURL;
  
  if (!configVersion) {
    handleError(1, 'No version detected for your config.\n\n Run: release --update-config');
  }
  else if (schema.version > configVersion) {
    handleError(1, `Your config appears to be out of date:\n   Schema version "${schema.version}" | Repo version "${configVersion}"\n\n Run: release --update-config`);
  }
  
  if (!REPO__HOST || !_supportedRepos.includes(REPO__HOST)) {
    const msg = [
      'Your config does not have an acceptable value for `REPO__HOST`',
      `Supported values are: ${_supportedRepos.join(', ')}`,
    ];
    handleError(1, msg.join('\n'));
  }
  
  if (REPO__HOST !== 'github' && !REPO__API_URL) {
    handleError(1, '`REPO__API_URL` needs to have a value when `REPO__HOST` does not equal `github`');
  }
  
  console.log(` ${color.green(SYMBOL__CHECK)} Config schema valid`);
  
  // Verify Docker setup =======================================================
  try {
    // https://www.dockerstatus.com/ has no API, but leaving here as a possible future source.
    
    const dockerConfig = require(`${process.env.HOME}/.docker/config.json`);
    let registryURL = Object.keys(dockerConfig.auths).find((url) => url.includes(DOCKER__REGISTRY_DOMAIN));
    const loggedIn = !!registryURL;
    
    if (loggedIn) {
      console.log(` ${color.green(SYMBOL__CHECK)} Docker is logged in`);
    }
    else {
      handleError(1, `You need to run \`docker login ${DOCKER__REGISTRY_DOMAIN} -u <USERNAME>\``);
    }
    
    registryURL = `${registryURL}search`; // for some reason the base URL now fails, but `/search` still works.
    const result = await cmd(`curl -i ${registryURL}`);
    if (result.includes('200 OK')) {
      console.log(` ${color.green(SYMBOL__CHECK)} Can connect to the Docker registry`);
    }
    else {
      handleError(1, `Could not connect to the Docker registry: ${registryURL}\n\n${result}`);
    }
  }
  catch (err) {
    handleError(1, `Problem verifying your Docker setup:\n${err}`);
  }
  
  // Verify Git setup ==========================================================
  const REMOTE_ORIGIN_URL = await cmd('git config --get remote.origin.url', {
    onError: () => {
      handleError(1, "Your repo is missing an origin URL");
    },
  });
  // The lookup is based on the assumption that the URLs end with `<USER>/<REPO>.git`.
  // Tested against:
  // - https://<HOSTNAME>/<USER>/<REPO>.git
  // - ssh://git@<HOSTNAME>:<PORT>/<USER>/<REPO>.git
  // - git@<HOSTNAME>:<USER>/<REPO>.git
  const gitOriginURLParts = REMOTE_ORIGIN_URL.match(/.*(\/|:)(?<repoUser>[^/:]+)\/(?<repoName>.+?(?=\.git))\.git$/);
  let repoName, repoUser;
  if (gitOriginURLParts) {
    ({ repoName, repoUser } = gitOriginURLParts.groups);
  }
  else {
    handleError(1, "Could not parse your repo's origin URL");
  }
  
  let repoToken = await cmd(`git config --global ${REPO__HOST}.token`, {
    onError: () => {
      handleError(1, `Looks like you haven't set up your repo's token yet.\n\n Run: ${color.cyan(`git config --global ${REPO__HOST}.token <YOUR_TOKEN>`)}`);
    },
  });
  console.log(` ${color.green(SYMBOL__CHECK)} Repo token set up`);
  
  const repoAPIURL = `${REPO__API_URL}/repos/${repoUser}/${repoName}`;
  await cmd(
    [
      'curl',
      '-H "Content-Type: application/json"',
      `-H "Authorization: token ${repoToken}"`,
      '--show-error --fail',
      repoAPIURL,
    ].join(' '),
    {
      onError: (err) => {
        handleError(1, `Problem testing repo API connection for ${repoAPIURL}:\n${err}`);
      },
    }
  );
  console.log(` ${color.green(SYMBOL__CHECK)} Can connect to repo API`);
  
  // Start the release process =================================================
  
  const PACKAGE_JSON = require(`${PATH__REPO_ROOT}/package.json`);
  let newChanges;
  
  let rollbacks = [];
  async function rollbackRelease() {
    if (rollbacks.length) {
      console.log(`\n ${color.black.bgYellow(' ROLLBACK ')} release`);
      // changes may have been additive, so roll things back from the end to the start
      for (let i=rollbacks.length - 1; i>=0; i--) {
        const { cmd: _cmd, content, file, label } = rollbacks[i];
        if (_cmd) await cmd(_cmd, { cwd: PATH__REPO_ROOT });
        else if (file) await writeFile(file, content);
        
        console.log(` - Reverted: ${color.blue.bold(label)}`);
      }
      
      rollbacks = [];
    }
  }
  
  function dryRunCmd(_cmd) {
    console.log(`\n ${color.black.bgYellow(' DRYRUN ')} ${color.blue.bold(_cmd)}`);
  }

  // Get current version number
  const ORIGINAL_VERSION = PACKAGE_JSON.version || '0.0.1';
  // Build out what the version would be based on what the user chooses
  const VERSION_NUMS = ORIGINAL_VERSION.split('.');
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
  const VERSION_STR = `v${NEW_VERSION}`;

  // Ensure tags are up to date
  renderHeader('FETCH', 'tags');
  await cmd('git fetch --tags', { silent: false });
  
  // Get previous tag info so that the changelog can be updated.
  let latestTagOrSHA;
  renderHeader('GET', 'latest tag or SHA');
  if (await cmd('git tag -l')) {
    latestTagOrSHA = await cmd('git describe --abbrev=0');
    console.log(`\n Latest tag: ${color.blue.bold(latestTagOrSHA)}`);
  }
  else {
    latestTagOrSHA = await cmd('git rev-parse --short $(git rev-list --max-parents=0 HEAD)');
    console.log(`\n No tags found, using first SHA: ${color.blue.bold(latestTagOrSHA)}`);
  }

  // Run tests if they exist
  const HAS_TEST_SCRIPT = PACKAGE_JSON.scripts && PACKAGE_JSON.scripts.test;
  if (HAS_TEST_SCRIPT) {
    renderHeader('RUN', 'tests');
    
    const runTests = await new CLISelect({
      label: color.yellow.bold('Run tests, or skip?'),
      options: [
        [color.green.bold('Yes, run tests'), true],
        [color.red.bold('Nah, skip tests'), false],
      ],
      selectedMsg: null,
    });
    
    if (runTests) {
      const testCmd = `cd ${PATH__REPO_ROOT} && npm test`;
      (args.dryRun)
        ? dryRunCmd(testCmd)
        : await cmd(testCmd, { silent: false });
    }
  }
  
  if (latestTagOrSHA) {
    renderHeader('ADD', 'new CHANGELOG items');
    
    const CHANGELOG_PATH = `${PATH__REPO_ROOT}/CHANGELOG.md`;
    const DEFAULT_CHANGELOG_CONTENT = '# Changelog\n---\n';
    
    if ( !(await fileExists(CHANGELOG_PATH)) ) {
      await writeFile(CHANGELOG_PATH, DEFAULT_CHANGELOG_CONTENT);
    }

    // const commits = await cmd('git log "v3.1.0".."v4.0.0" --oneline');
    const commits = await cmd(`git log "${latestTagOrSHA}"..HEAD --oneline`);
    const categories = {
      'Bugfixes': [],
      'Dev-Ops': [],
      'Features': [],
      'Misc. Tasks': [],
      'Uncategorized': [],
    };
    
    try {
      const TITLE_PREFIX = ': ';
      const COMMIT_TITLE_REGEX = / (?<type>chore|feat|fix|ops|task):(?:[\w\d-_]+)?( -)? /i;
      commits.split('\n')
        .map(commit => commit.replace(/^([a-z0-9]+)\s/i, `- [$1](/${repoUser}/${repoName}/commit/$1) `))
        .forEach(commit => {
          if (COMMIT_TITLE_REGEX.test(commit)) {
            const m = commit.match(COMMIT_TITLE_REGEX) || { groups: {} };
            const { groups: { type } } = m;
            
            switch (type) {
              case 'fix':
                categories['Bugfixes'].push(commit.replace(m[0], TITLE_PREFIX));
                break;
              case 'ops':
                categories['Dev-Ops'].push(commit.replace(m[0], TITLE_PREFIX));
                break;
              case 'feat':
                categories['Features'].push(commit.replace(m[0], TITLE_PREFIX));
                break;
              case 'chore':
              case 'task':
                categories['Misc. Tasks'].push(commit.replace(m[0], TITLE_PREFIX));
                break;
            }
          }
          else {
            categories['Uncategorized'].push(commit);
          }
        });
      
      newChanges = Object.keys(categories)
        .map(category => {
          const categoryItems = categories[category];
          return (categoryItems.length)
            ? `  **${category}**\n  ${categoryItems.join('\n  ')}`
            : null;
        })
        .filter(category => !!category)
        .join('\n\n');
    }
    catch (err) { handleError(1, `Couldn't parse commit messages:\n${err}`); }
    
    // Add changes to top of logs
    const originalLog = await readFile(CHANGELOG_PATH, 'utf8');
    if (newChanges) {
      const newLog = `\n## ${VERSION_STR}\n\n<details>\n  <summary>Expand for ${VERSION_STR} Details</summary>\n\n${newChanges}\n</details>\n\n---\n`;
      const changelog = originalLog.replace(
        new RegExp(`(${DEFAULT_CHANGELOG_CONTENT})`),
        `$1${newLog}`
      );
      
      if (args.dryRun) {
        const trimmedLog = changelog.slice(0, `${DEFAULT_CHANGELOG_CONTENT}${newLog}`.length);
        dryRunCmd(`writeFile(\n  '${CHANGELOG_PATH}',\n${trimmedLog}\n[...rest of file]\n\n)`);
      }
      else {
        await writeFile(CHANGELOG_PATH, changelog);
        rollbacks.push({ label: 'CHANGELOG', file: CHANGELOG_PATH, content: originalLog });
      }
    }
  }
  
  renderHeader('BUMP', 'Node package version');
  const NPM_BUMP_CMD = `npm version --no-git-tag-version ${NEW_VERSION}`;
  if (args.dryRun) dryRunCmd(NPM_BUMP_CMD);
  else {
    rollbacks.push({
      label: 'Node package version',
      cmd: `npm version --no-git-tag-version --allow-same-version ${ORIGINAL_VERSION}`,
    });
    await cmd(NPM_BUMP_CMD, {
      cwd: PATH__REPO_ROOT,
      onError: rollbackRelease,
      silent: false,
    });
  }
  
  if (CMD__COMPILE_ASSETS) {
    renderHeader('COMPILE', 'assets');
    if (args.dryRun) dryRunCmd(CMD__COMPILE_ASSETS);
    else await cmd(CMD__COMPILE_ASSETS, {
      cwd: PATH__REPO_ROOT,
      onError: rollbackRelease,
      silent: false,
    });
  }
  
  if (CMD__DOCKER_BUILD) {
    renderHeader('BUILD', 'Docker Image');
    if (args.dryRun) dryRunCmd(CMD__DOCKER_BUILD);
    else await cmd(CMD__DOCKER_BUILD, {
      cwd: PATH__REPO_ROOT,
      onError: rollbackRelease,
      silent: false,
    });
  }
  
  renderHeader('START', 'App');
  if (CMD__DOCKER_START) {
    if (args.dryRun) dryRunCmd(CMD__DOCKER_START);
    else {
      await cmd(CMD__DOCKER_START, {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
    }
  }
  
  const continueRelease = await new CLISelect({
    label: `${color.green('Verify things are running properly at')}: ${color.blue.bold.underline(APP__TEST_URL)}`,
    options: [
      ['Continue with release', true],
      ['Abort release', false],
    ],
    selectedMsg: null,
  });
  
  renderHeader('STOP', 'App');
  if (CMD__DOCKER_START) {
    if (!args.dryRun) {
      await cmd('docker compose down', {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
    }
  }

  if (continueRelease) {
    // Finalize versioning for repo files ======================================
    renderHeader('ADD', 'updated files');
    const ADD_CMD = 'git add -f CHANGELOG.md package*.json';
    if (args.dryRun) dryRunCmd(ADD_CMD);
    else {
      await cmd(ADD_CMD, {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
      rollbacks.push({ label: 'Staged changes', cmd: 'git reset' });
    }

    renderHeader('COMMIT', 'updated files');
    const COMMIT_CMD = `git commit -m "Bump to ${VERSION_STR}"`;
    if (args.dryRun) dryRunCmd(COMMIT_CMD);
    else {
      await cmd(COMMIT_CMD, {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
      rollbacks.push({ label: 'Bump commit', cmd: 'git reset --soft HEAD~1' });
    }
    
    // Version the latest commit ===============================================
    renderHeader('GIT_TAG', 'the release');
    const escapedNewChanges = newChanges
      .replace(/"/g, '\\"')
      .replace(/`/g, '\\`');
    const GIT_CHANGELOG_MSG = `## ${VERSION_STR}\n\n<details>\n  <summary>Expand for ${VERSION_STR} Details</summary>\n\n${escapedNewChanges}\n</details>`;
    const GIT_TAG_CMD = `git tag -a "${VERSION_STR}" -m "${GIT_CHANGELOG_MSG}"`;
    if (args.dryRun) dryRunCmd(GIT_TAG_CMD);
    else {
      await cmd(GIT_TAG_CMD, {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
      rollbacks.push({ label: 'Git tag', cmd: `git tag -d "${VERSION_STR}"` });
    }
    
    // Version the latest Docker image =========================================
    const DOCKER_TAG = `${DOCKER__IMG_NAME}:${VERSION_STR}`;
    const LATEST_REGEX = new RegExp(`^${DOCKER__IMG_NAME}.*latest`);
    const LATEST_ID = (await cmd('docker images')).split('\n').filter(line => LATEST_REGEX.test(line)).map(line => line.split(/\s+/)[2])[0];
    
    renderHeader('DOCKER_TAG', 'the release');
    const DOCKER_TAG_CMD = `docker tag "${LATEST_ID}" "${DOCKER_TAG}"`;
    if (args.dryRun) dryRunCmd(DOCKER_TAG_CMD);
    else {
      await cmd(DOCKER_TAG_CMD, {
        cwd: PATH__REPO_ROOT,
        onError: rollbackRelease,
        silent: false,
      });
      rollbacks.push({ label: 'Docker tag', cmd: `docker rmi "${DOCKER_TAG}"` });
    }
    
    // Give the User one last chance to back out ===============================
    const finalizeRelease = await new CLISelect({
      label: color.yellow.bold('Finalize release by deploying all data?'),
      options: [
        [color.green.bold('Yes, finalize'), true],
        [color.red.bold('No, abort!'), false],
      ],
      selectedMsg: null,
    });
    
    if (finalizeRelease) {
      // Push up changelog and versioned tag ===================================
      renderHeader('PUSH', 'Git commit and tag');
      const GIT_PUSH_CMD = 'git push --follow-tags';
      if (args.dryRun) dryRunCmd(GIT_PUSH_CMD);
      else {
        await cmd(GIT_PUSH_CMD, {
          cwd: PATH__REPO_ROOT,
          onError: rollbackRelease,
          silent: false,
        });
        rollbacks.push({ label: 'Pushed Git tag', cmd: `git push --delete origin "${VERSION_STR}"` });
      }
      
      // Deploy versioned images to Docker registry ============================
      renderHeader('PUSH', 'Docker tags');
      const DOCKER_PUSH_CMD = `docker push "${DOCKER_TAG}" && docker push "${DOCKER__IMG_NAME}:latest"`;
      if (args.dryRun) dryRunCmd(DOCKER_PUSH_CMD);
      else {
        await cmd(DOCKER_PUSH_CMD, {
          cwd: PATH__REPO_ROOT,
          onError: rollbackRelease,
          silent: false,
        });
      }
      
      // Deploy release to upstream repo =======================================
      if (args.dryRun && !args.showCreds) repoToken = '******';
      
      renderHeader('CREATE', `${REPO__HOST} release`);
      
      const BRANCH = await cmd('git rev-parse --abbrev-ref HEAD');
      const JSON_PAYLOAD = JSON.stringify({
        body: GIT_CHANGELOG_MSG,
        draft: false,
        name: VERSION_STR,
        prerelease: false,
        tag_name: VERSION_STR,
        target_commitish: BRANCH,
      });
      
      // https://developer.github.com/v3/repos/releases/#create-a-release
      const REPO_API__RELEASES_URL = `${REPO__API_URL}/repos/${repoUser}/${repoName}/releases`;
      const CURL_CMD = [
        'curl',
        '-H "Content-Type: application/json"',
        `-H "Authorization: token ${repoToken}"`,
        '-X POST',
        `-d '${JSON_PAYLOAD.replace(/'/g, '\\u0027')}'`,
        '--silent --output /dev/null --show-error --fail',
        REPO_API__RELEASES_URL,
      ].join(' ');
      
      if (args.dryRun) {
        console.log(
              `  ${color.green('Payload')}: ${JSON.stringify(JSON.parse(JSON_PAYLOAD), null, 2)}`
          +`\n  ${color.green('URL')}: ${color.blue.bold.underline(REPO_API__RELEASES_URL)}`
        );
        dryRunCmd(CURL_CMD);
      }
      else await cmd(CURL_CMD, {
        onError: rollbackRelease,
        silent: false,
      });
    }
    else {
      await rollbackRelease();
    }
  }
  else {
    await rollbackRelease();
  }
})();
