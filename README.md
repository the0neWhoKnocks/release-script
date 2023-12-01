# Release Script

A script to help you release/publish code.

- [Pre-Install](#pre-install)
- [Install](#install)
- [Run](#run)

---

## Pre-Install

**Prerequisites**:
- Your repo is already set up. The script keys off of info in your `package.json` and your `git` config.
- `curl` is used to publish release data to git repos.
- `docker` is used to ship a consistent application environment.
  - To be able to `docker push` containers you'll need to `docker login`. Docker recomends using a credentials store, but it's too much of a headache to set up. Instead I opt for just using an access token.
    - Log in to DockerHub
    - Click on your User > Account Settings > Security > (click) **New Access Token**
        ```
        Description: Application Deployment
        Permissions: Read, Write, Delete
        ```
        (click) **Generate**
    - Store the generated token somewhere because it won't be displayed again.
    - Locally run:
        ```sh
        # If you're currently logged in
        docker logout
        
        # Log in with token
        docker login docker.io -u <USER>
        # paste in access token when prompted
        ```
        `docker.io` is implied when using just `docker login`, but it's good to be specific in case you utilize other Docker registries.
- `node` is used to run the script, and my preferred runtime.
- If you want to publish releases:
  - On **GitHub**, you'll need to set up a [Personal Access Token](https://github.com/settings/tokens).
    1. Click `Generate new token`
        - Regardless of what GitHub recommends, I set my token to never expire.
    1. Add a name (Note) for the token
    1. Check the `repo` checkmark. Top-level access isn't required for Public repos, but there may come a time that you want to release to a Private repo and you'll get blocked if you don't have a token with elevated privileges.
    1. Copy the new token and run:
        ```sh
        git config --global github.token <YOUR_TOKEN>
        ```
  - On **Gitea**, you'll need to set up an Access Token by going to `<DOMAIN>/user/settings/applications`.
    1. In the **Manage Access Tokens** section, enter a name for your token and click `Generate Token`.
    1. Copy the new token and run:
        ```sh
        git config --global gitea.token <YOUR_TOKEN>
        ```

---

## Install

1. Clone the repo.
1. In your `*rc` file add:
    ```sh
    source ~/<REPO_PATH>/bin/release.sh
    ```

---

## Run

Within the repo you want to release:
```sh
release

# View all available flags
release --help
```
