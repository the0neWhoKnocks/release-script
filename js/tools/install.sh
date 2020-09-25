#!/bin/sh

set -e

# Default settings
INSTALL_DIR=${INSTALL_DIR:-"bin"}

# Only use colors if connected to a terminal
if [ -t 1 ]; then
  CSI='\033['
  BLACK=$(printf "${CSI}30m")
  RED=$(printf "${CSI}31m")
  RED_BG=$(printf "${CSI}41m")
  GREEN=$(printf "${CSI}32m")
  YELLOW=$(printf "${CSI}33m")
  BLUE=$(printf "${CSI}34m")
  RESET=$(printf "${CSI}0m")
else
  BLACK=""
  RED=""
  RED_BG=""
  GREEN=""
  YELLOW=""
  BLUE=""
  RESET=""
fi

error() {
  echo "\n ${BLACK}${RED_BG} ERROR ${RESET}${RED} $@${RESET}" >&2
  exit 1
}

exitIfNotFound() {
  isBinary=${2:-false}
  
  if ${isBinary}; then
    command -v "$1" >/dev/null 2>&1 || {
      error "$1 is not installed"
    }
  elif [ ! -f "${PWD}/$1" ]; then
    error "\"${YELLOW}${PWD}/$1${RESET}${RED}\" is missing."
  fi
}

exitIfFound() {
  file="$1"
  errMsg="$2"
  
  if [ -f "${PWD}/${file}" ]; then
    error "${errMsg}"
  fi
}

install() {
  FIRST_MSG_PREFIX="Installing"
  UPDATING=false
  FORCE_INSTALL=false
  
  # Parse arguments
  while [ $# -gt 0 ]; do
    case $1 in
      --force)
        FORCE_INSTALL=true
        ;;
      --install-dir)
        INSTALL_DIR=$2
        shift
        ;;
      --update)
        UPDATING=true
        FIRST_MSG_PREFIX="Updating"
        ;;
    esac
    shift
  done
  
  ABS_INSTALL_DIR="${PWD}/${INSTALL_DIR}"
  
  if ! ${UPDATING} && ! ${FORCE_INSTALL}; then
    exitIfFound "${INSTALL_DIR}/release.js" "The release script is already installed.\n\n If you want to install anyway, use the '--force' flag."
  fi
  
  echo;
  echo " ${FIRST_MSG_PREFIX} release script in ${BLUE}${ABS_INSTALL_DIR}${RESET}"
  echo;

  exitIfNotFound curl true
  exitIfNotFound "package.json"
  exitIfNotFound ".git/config"
  
  # Create bin directory
  if ! ${UPDATING}; then
    mkdir -p "${ABS_INSTALL_DIR}"
  fi
  
  if ${UPDATING}; then
    # Update files
    (
      cd "${ABS_INSTALL_DIR}" \
      && echo "   1. Updating files..." \
      && curl -s -O "https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/bin/release.js"
    )
  else
    # Download files
    (
      cd "${ABS_INSTALL_DIR}" \
      && umask g-w,o-w \
      && echo "   1. Downloading files..." \
      && curl -s -O "https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/bin/.creds-docker" \
      && curl -s -O "https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/bin/release-config.js" \
      && curl -s -O "https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/bin/release.js"
    )
  fi
  
  # Add package.json scripts
  if ${UPDATING}; then
    echo "   2. Updating ${BLUE}package.json${RESET} scripts"
  else
    echo "   2. Adding ${BLUE}package.json${RESET} scripts"
  fi
  node -e "
    const { writeFileSync } = require('fs');
    const { resolve } = require('path');
    const package = require('./package.json');
    
    package.scripts.release = './${INSTALL_DIR}/release.js';
    package.scripts['release:dryrun'] = './${INSTALL_DIR}/release.js -dr';
    package.scripts['release:update'] = 'sh -c \"\$(curl -fsSL https://raw.githubusercontent.com/the0neWhoKnocks/release-script/master/js/tools/install.sh) --update --install-dir \\\\\"${INSTALL_DIR}\\\\\"\"';
    
    writeFileSync(resolve(__dirname, 'package.json'), JSON.stringify(package, null, 2));
  "
  
  echo;
  echo " ${GREEN}All done${RESET}"
  echo " Run ${BLUE}npm run release:dryrun${RESET} to test it out"
}

install "$@"
