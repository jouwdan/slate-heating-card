# Publishing v0.1.0

This folder is the repository root. No build is required.

1. Create a public GitHub repository named `slate-heating-card`. Add a description and topics such as `home-assistant`, `hacs`, `lovelace`, `heating`.
2. Commit this folder's contents at the repository root, including `slate-heating-card.js`, `hacs.json`, README, licence, examples and screenshots.
3. Run `npm test`. Review the README and relative image links on GitHub.
4. Create Git tag **v0.1.0**, then a GitHub release for that tag. Attach **slate-heating-card.js** as a release asset. A source ZIP may also be attached, but is not the HACS runtime asset.
5. Replace the README's pre-publication note with the actual repository URL and installation link. Users can then add the repository in HACS as a **Dashboard** custom repository.
6. Test a clean HACS installation, resource registration and frontend reload before announcing the release. Default HACS listing is a separate submission; custom repository compatibility does not imply inclusion.

The root `hacs.json` specifies `filename` and `content_in_root`. HACS dashboard packages use a JavaScript module, not the integration-only `zip_release` flow. See the [official dashboard requirements](https://www.hacs.xyz/docs/publish/plugin/) and [repository requirements](https://www.hacs.xyz/docs/publish/start/).

For later releases, update the source `VERSION`, package version, changelog and manual-install cache query together; rerun tests and refresh screenshots when the UI changes. Do not commit private HA configuration or credentials.
