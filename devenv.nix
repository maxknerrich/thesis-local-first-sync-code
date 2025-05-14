{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };
}
