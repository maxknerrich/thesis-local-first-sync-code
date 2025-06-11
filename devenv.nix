{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  pkgs-playwright = import inputs.nixpkgs-playwright {system = pkgs.stdenv.system;};
  browsers = (builtins.fromJSON (builtins.readFile "${pkgs-playwright.playwright-driver}/browsers.json")).browsers;
  chromium-rev = (builtins.head (builtins.filter (x: x.name == "chromium") browsers)).revision;
in {
  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs-playwright.playwright.browsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = true;
    PLAYWRIGHT_NODEJS_PATH = "${pkgs.nodejs}/bin/node";
    PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH = "${pkgs-playwright.playwright.browsers}/chromium-${chromium-rev}/chrome-linux/chrome";
  };

  dotenv.disableHint = true;
  cachix.enable = false;

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };

  scripts.intro.exec = ''
    playwrightNpmVersion="$(bun -e "console.log(require('./node_modules/@playwright/test/package.json').version)")"
    echo "❄️ Playwright nix version: ${pkgs-playwright.playwright.version}"
    echo "📦 Playwright npm version: $playwrightNpmVersion"

    if [ "${pkgs-playwright.playwright.version}" != "$playwrightNpmVersion" ]; then
        echo "❌ Playwright versions in nix (in devenv.yaml) and npm (in package.json) are not the same! Please adapt the configuration."
    else
        echo "✅ Playwright versions in nix and npm are the same"
    fi

    echo
    env | grep ^PLAYWRIGHT
  '';

  enterShell = ''
    intro
  '';
}
