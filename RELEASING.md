# Publishing releases

The public repository is [jouwdan/slate-heating-card](https://github.com/jouwdan/slate-heating-card). This folder is its root; no build is required. Users can install it through HACS as a **Dashboard** custom repository using that URL.

## Release checklist

1. Update the source `VERSION`, package version, changelog and README/manual-install cache query together. The initial version is **0.1.0**.
2. Run `npm test`. Review the README, examples and relative screenshot links on GitHub; refresh screenshots when the UI changes.
3. Commit and push the release changes. Keep `slate-heating-card.js` and `hacs.json` at the repository root.
4. Create a version tag, such as **v0.1.0**, then create a [GitHub release](https://github.com/jouwdan/slate-heating-card/releases/new) for that tag. Attach **slate-heating-card.js** as a release asset. A source ZIP may also be attached, but is not the HACS runtime asset.
5. Test a clean HACS installation, resource registration and frontend reload before announcing the release. Test an upgrade from the previous version when applicable.

Publishing the repository and publishing a versioned GitHub release are separate steps. The initial repository has been published; follow the checklist to publish versioned releases. Default HACS catalogue inclusion is a separate submission and is not required for custom-repository installation.

The root `hacs.json` specifies `filename` and `content_in_root`. HACS dashboard packages use a JavaScript module, not the integration-only `zip_release` flow. See the [official dashboard requirements](https://www.hacs.xyz/docs/publish/plugin/) and [repository requirements](https://www.hacs.xyz/docs/publish/start/).

Do not commit private HA configuration or credentials.
