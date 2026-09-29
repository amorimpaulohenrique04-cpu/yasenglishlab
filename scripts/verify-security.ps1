$ErrorActionPreference = "Stop"
npm.cmd run verify:security
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
