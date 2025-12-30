param (
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$TestArgs
)

Write-Host "Stopping apps (cleanup)"
npm run openfin:stop 2>$null

Write-Host "Starting apps"
npm run openfin:start

Write-Host "Running tests with args: $TestArgs"
npm test -- $TestArgs
$exitCode = $LASTEXITCODE

if ($exitCode -eq 42) {
  Write-Host "Child app unhealthy – restarting everything"

  npm run openfin:stop 2>$null
  npm run openfin:start

  Write-Host "Re-running tests with args: $TestArgs"
  npm test -- $TestArgs
  exit $LASTEXITCODE
}

exit $exitCode
