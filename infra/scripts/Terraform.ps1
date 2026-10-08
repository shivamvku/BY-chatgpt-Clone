[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('bootstrap','foundation','migrations','application','domains')][string]$Stack,
    [Parameter(Mandatory)][ValidateSet('init','validate','plan','apply')][string]$Action,
    [string]$VariablesFile,
    [string]$BackendFile,
    [string]$PlanFile
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stackDirectory = if ($Stack -eq 'bootstrap') { Join-Path $repoRoot 'infra/bootstrap' } else { Join-Path $repoRoot "infra/terraform/environments/dev/$Stack" }
$arguments = @("-chdir=$stackDirectory", $Action)
switch ($Action) {
    'init' {
        $arguments += '-input=false'
        if ($Stack -ne 'bootstrap') {
            if (-not $BackendFile) { throw 'BackendFile is required' }
            $arguments += "-backend-config=$((Resolve-Path $BackendFile).Path)"
            $arguments += "-backend-config=key=dev/$Stack.tfstate"
        }
    }
    'plan' {
        if (-not $VariablesFile -or -not $PlanFile) { throw 'VariablesFile and PlanFile are required' }
        $arguments += @('-input=false', "-var-file=$((Resolve-Path $VariablesFile).Path)", "-out=$([IO.Path]::GetFullPath($PlanFile))")
    }
    'apply' {
        if (-not $PlanFile) { throw 'Apply requires a previously reviewed PlanFile' }
        $arguments += [IO.Path]::GetFullPath($PlanFile)
    }
}
& terraform @arguments
if ($LASTEXITCODE -ne 0) { throw "Terraform $Action failed" }
if ($Stack -eq 'bootstrap' -and $Action -eq 'apply') {
    $remoteBackend = Join-Path $stackDirectory 'backend.remote.tf'
    if (-not (Test-Path -LiteralPath $remoteBackend)) {
        & (Join-Path $PSScriptRoot 'Migrate-BootstrapState.ps1')
    }
}
