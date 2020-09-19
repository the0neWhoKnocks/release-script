const { resolve } = require('path');

module.exports = {
  // Common name shared for Docker image, NPM module, etc.
  APP__NAME: '<APP_NAME>',
  // URL that the App will be available at once started.
  APP__TEST_URL: '<APP_URL>',
  // Command to build specific or all Docker containers
  CMD__DOCKER_BUILD: 'docker-compose build',
  // Command to start the built Container(s), so a Dev can verify before it's deployed
  CMD__DOCKER_START: '<START_DOCKER_CMD>',
  // Command to compile any assets that may be needed by Docker, shipped off to S3, etc.
  CMD__COMPILE_ASSETS: 'npm run compile',
  // An absolute path to a file containing a DockerHub username & password
  PATH__CREDS__DOCKER: resolve(__dirname, '.creds-docker'),
  // An absolute path to a file containing an NPM username & password
  PATH__CREDS__NPM: resolve(__dirname, '.creds-npm'),
  // An absolute path to the root of your repo
  PATH__REPO_ROOT: resolve(__dirname, '../'),
};
