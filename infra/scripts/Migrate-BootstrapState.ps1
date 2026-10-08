[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$bootstrapDirectory = (Resolve-Path (Join-Path $PSScriptRoot '../bootstrap')).Path
$backendDefinition = Join-Path $bootstrapDirectory 'backend.remote.tf'
if (Test-Path -LiteralPath $backendDefinition) {
    throw 'Remote backend definition already exists. Inspect the existing backend before migration.'
}
$backendJson = & terraform "-chdir=$bootstrapDirectory" output -json backend
if ($LASTEXITCODE -ne 0) { throw 'Cannot read bootstrap backend outputs' }
$backend = $backendJson | ConvertFrom-Json
$exists = az storage blob exists --account-name $backend.storage_account_name --container-name $backend.container_name --name 'bootstrap.tfstate' --auth-mode login --query exists -o tsv
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify the destination state blob' }
if ($exists.Trim() -eq 'true') { throw 'Destination state already exists; refusing to overwrite it' }
$configuration = @"
resource_group_name = "$($backend.resource_group_name)"
storage_account_name = "$($backend.storage_account_name)"
container_name = "$($backend.container_name)"
key = "bootstrap.tfstate"
use_azuread_auth = true
"@
$backendConfiguration = Join-Path $bootstrapDirectory 'backend.hcl'
[IO.File]::WriteAllText($backendConfiguration, $configuration, [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../config/bootstrap-backend.tf.example') -Destination $backendDefinition
& terraform "-chdir=$bootstrapDirectory" init -migrate-state -force-copy "-backend-config=$backendConfiguration"
if ($LASTEXITCODE -ne 0) { throw 'State migration failed. Keep local state and inspect backend configuration before retrying.' }
Write-Output 'Bootstrap state migrated to Azure Blob Storage. Secure any residual local state backups.'
