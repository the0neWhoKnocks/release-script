#!/bin/bash

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SYMBOL__CHECK="\u2714"
SYMBOL__X="\u2716"

# Only use colors if connected to a terminal
if [ -t 1 ]; then
  CSI='\033['
  BLACK=$(printf "${CSI}30m")
  RED=$(printf "${CSI}31m")
  RED_BG=$(printf "${CSI}41m")
  GREEN=$(printf "${CSI}32m")
  YELLOW=$(printf "${CSI}33m")
  YELLOW_BG=$(printf "${CSI}43m")
  BLUE=$(printf "${CSI}34m")
  RESET=$(printf "${CSI}0m")
else
  BLACK=""
  RED=""
  RED_BG=""
  GREEN=""
  YELLOW=""
  YELLOW_BG=""
  BLUE=""
  RESET=""
fi

error() {
  echo -e "\n ${BLACK}${RED_BG} ERROR ${RESET}${RED} $@${RESET}" >&2
  exit 1
}

warn() {
  echo -e "\n ${BLACK}${YELLOW_BG} WARN ${RESET} $@${RESET}" >&2
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

function release {
  local REPO_DIR="$PWD"
  
  (
    cd "${SCRIPT_DIR}"
    
    # Check if repo out of date
    echo ""
    echo " Checking script status..."
    local currBranch=$(git rev-parse --abbrev-ref HEAD)
    local result=$( echo $(git remote update; git status -uno) | grep "branch is behind" )
    # Prompt User to update
    if [[ "$result" != "" ]]; then
      warn "Release script is out of date."
      
      while true; do
        read "yn? Update release script (y/n)?: "
        case $yn in
          [Yy]* )
            git pull --rebase origin "${currBranch}"
            echo " Update complete. You'll need to source this script and re-run your previous command."
            return 0
            break
            ;;
          [Nn]* ) break;;
          * ) echo " Please answer (y)es or (n)o.";;
        esac
      done
    else
      echo " ${GREEN}${SYMBOL__CHECK}${RESET} Script is current."
    fi
    
    cd "${REPO_DIR}"
    
    # Base dependency check
    exitIfNotFound curl true
    exitIfNotFound docker true
    exitIfNotFound node true
    exitIfNotFound "package.json"
    exitIfNotFound ".git/config"
    
    node "${SCRIPT_DIR}/release.js" "$@"
  )
}
