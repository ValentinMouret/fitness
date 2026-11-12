{
  description = "Inbox";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };
        bunVersion = pkgs.lib.removeSuffix "\n" (builtins.readFile ./.bun-version);
        bunArchive = {
          aarch64-darwin = {
            name = "bun-darwin-aarch64";
            sha256 = "c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510";
          };
          aarch64-linux = {
            name = "bun-linux-aarch64";
            sha256 = "baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e";
          };
          x86_64-darwin = {
            name = "bun-darwin-x64-baseline";
            sha256 = "d4a155adfbfd09155eb3ba05c9e3a544f39297d7a68616d3c7759f67ab5c47dc";
          };
          x86_64-linux = {
            name = "bun-linux-x64";
            sha256 = "bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c";
          };
        }.${system} or (throw "Unsupported Bun platform: ${system}");
        bun = pkgs.bun.overrideAttrs (_: {
          version = bunVersion;
          src = pkgs.fetchurl {
            url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/${bunArchive.name}.zip";
            sha256 = bunArchive.sha256;
          };
        });
        nodeVersion = pkgs.lib.removeSuffix "\n" (builtins.readFile ./.node-version);
        node = pkgs.callPackage "${pkgs.path}/pkgs/development/web/nodejs/nodejs.nix" {
          python = pkgs.python3;
        } {
          version = nodeVersion;
          sha256 = "6cce7c58bf058700c643944903d60a325e8c9ceede1f5c2c088b435f2ada091a";
          # Node's bundled npm already contains this gyp fix.
          patches = builtins.filter (
            patch: (patch.name or "") != "8224deef984add7e7afe846cfb82c9d3fa6da1fb.patch?full_index=1"
          ) pkgs.nodejs_22.patches;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            bun
            node
          ];
        };
      }
    );
}
