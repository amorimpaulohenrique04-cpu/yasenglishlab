$ErrorActionPreference = "Stop"
npm.cmd run verify:ui
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
