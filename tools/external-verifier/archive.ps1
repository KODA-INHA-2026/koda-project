param(
  [Parameter(Mandatory = $true)][string]$SourceDirectory,
  [Parameter(Mandatory = $true)][string]$DestinationPath
)

$resolvedSource = (Resolve-Path -LiteralPath $SourceDirectory).Path
Compress-Archive -Path (Join-Path $resolvedSource '*') -DestinationPath $DestinationPath -Force
