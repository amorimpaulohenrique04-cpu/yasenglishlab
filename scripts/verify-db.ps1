$ErrorActionPreference = "Stop"
npm.cmd run verify:db
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
