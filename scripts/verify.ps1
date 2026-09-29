$ErrorActionPreference = "Stop"
npm.cmd run verify:agent
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
