{
  description = "React component for entering PIN codes.";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-21.11";
    utils.url = "github:numtide/flake-utils";
    flake-compat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, utils, ... }:
    utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          devShell = pkgs.mkShell {
            buildInputs = with pkgs; [
              # Common tools
              coreutils
              ripgrep

              # Nix LSP + formatter
              rnix-lsp
              nixpkgs-fmt

              # Node.js env
              nodejs-16_x
              cypress
              yarn
            ];
            shellHook = ''
              # configure cypress
              export CYPRESS_RUN_BINARY="${pkgs.cypress}/bin/Cypress"

              # add node_modules/.bin to path
              export PATH="$PWD/node_modules/.bin/:$PATH"
            '';
          };
        }
      );
}
