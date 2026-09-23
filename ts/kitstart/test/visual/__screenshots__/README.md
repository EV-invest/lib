# Widget baselines

PNG per gallery page and width, compared byte for byte by
`nix run .#kitstart-visual`. Linux only: take them from the `kitstart-visual`
artifact of the `kitstart` workflow, never from a mac:

```sh
rm -f ts/kitstart/test/visual/__screenshots__/*.png
gh run download <run-id> -n kitstart-visual -D ts/kitstart/test/visual/__screenshots__
```
