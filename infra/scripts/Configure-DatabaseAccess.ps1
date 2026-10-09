[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Cidr,
    [Parameter(Mandatory)][string]$PublicKeyPath,
    [string]$Repository = 'shivamvku/BY-chatgpt-Clone'
)
$ErrorActionPreference = 'Stop'
if ($Cidr -notmatch '^\d{1,3}(\.\d{1,3}){3}/32$') { throw 'Supply one public IPv4 /32' }
$operatorKeyFile = (Resolve-Path -LiteralPath $PublicKeyPath).Path
if ([IO.Path]::GetExtension($operatorKeyFile) -ne '.pub') { throw 'Only a public-key file is accepted' }
$operatorPublicKey = (Get-Content -LiteralPath $operatorKeyFile -Raw).Trim()
if ($operatorPublicKey -notmatch '^ssh-(ed25519|rsa) [A-Za-z0-9+/=]+') { throw 'Invalid public key' }
gh variable set DB_ACCESS_CIDR --repo $Repository --body $Cidr
if ($LASTEXITCODE -ne 0) { throw 'Cannot configure the operator IP' }
gh variable set DB_ACCESS_PUBLIC_KEY --repo $Repository --body $operatorPublicKey
if ($LASTEXITCODE -ne 0) { throw 'Cannot configure the SSH public key' }
Write-Output 'Database-access repository variables configured; no private key was read or uploaded.'
