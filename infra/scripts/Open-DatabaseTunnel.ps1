[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^\d{1,3}(\.\d{1,3}){3}$')][string]$SshHost,
    [string]$PrivateKeyPath = (Join-Path $env:USERPROFILE '.ssh/id_ed25519'),
    [int]$LocalPort = 25433,
    [string]$ResourceGroup = 'bychat-dev-rg',
    [string]$VmName = 'bychat-dev-db-access'
)
$ErrorActionPreference = 'Stop'
if ($LocalPort -lt 1024 -or $LocalPort -gt 65535) { throw 'Use a valid non-privileged local port' }
if (Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue) { throw 'Local port is already in use' }
$metadata = az vm extension show -g $ResourceGroup --vm-name $VmName -n ssh-host-key --instance-view -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify the SSH server identity through Azure' }
$messages = ($metadata.instanceView.substatuses.message + $metadata.instanceView.statuses.message) -join ' '
$expectedFingerprint = [regex]::Match($messages, 'SHA256:[A-Za-z0-9+/]+').Value
if (-not $expectedFingerprint) { throw 'Azure has not reported the SSH fingerprint yet' }
$taskDirectory = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '../..')) '.codex-tmp'
New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
$knownHostsFile = Join-Path $taskDirectory 'database-known-hosts'
ssh-keyscan -T 10 -t ed25519 $SshHost 2>$null | Set-Content -LiteralPath $knownHostsFile -Encoding ascii
$scannedFingerprint = (ssh-keygen -lf $knownHostsFile) -join ' '
if ($LASTEXITCODE -ne 0 -or $scannedFingerprint -notmatch [regex]::Escape($expectedFingerprint)) { throw 'SSH fingerprint mismatch; connection refused' }
$resolvedKey = (Resolve-Path -LiteralPath $PrivateKeyPath).Path
$sshArguments = @('-N', '-i', "`"$resolvedKey`"", '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'StrictHostKeyChecking=yes', '-o', "UserKnownHostsFile=`"$knownHostsFile`"", '-L', "127.0.0.1:${LocalPort}:bychat-dev-pg.postgres.database.azure.com:5432", "dbaccess@$SshHost")
$tunnel = Start-Process -FilePath (Get-Command ssh).Source -ArgumentList $sshArguments -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
if ($tunnel.HasExited) { throw 'SSH authentication failed; use DBeaver to unlock a passphrase-protected key interactively' }
Write-Output "Verified SSH tunnel: 127.0.0.1:$LocalPort (process $($tunnel.Id))"
