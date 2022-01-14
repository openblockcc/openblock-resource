# openblock-resource

[![Publish npm package](https://github.com/openblockcc/openblock-resource/actions/workflows/publish.yml/badge.svg)](https://github.com/openblockcc/openblock-resource/actions/workflows/publish.yml)
![GitHub](https://img.shields.io/github/license/openblockcc/openblock-resource)

Provide a local resource server for openblock. It also includes some cli tools for resource translation and pre-process before release.

## Instructions

- Start resource server

    ```bash
    npm install
    npm run fetch
    npm start
    ```

- Test upgrade funciton, run:

    ```bash
    npm test
    ```

- Cli tools

  - Pre-process tools for release

    - **opt-size** used to delete useless files to reduce the expansion size

    - **gen-config** used to generate a configuration file that records the update parameters

        eg: `gen-config --version=v0.0.1 --repo=openblockcc/external-resources --cdn=https://cdn.openblock.cc/`

    - **gen-hash** used to generate the hash of the external-resource folder to verify the integrity of the content after copying the folder to the cache

  - Translation tools

    - **i18n-extract** used to extract all i18n content within resources identified as community official extensions

    - **i18n-push** used to push the extracted i18n content to transifex

    - **i18n-update** used to pull the translation content on transifex, generate and update the local translation file
