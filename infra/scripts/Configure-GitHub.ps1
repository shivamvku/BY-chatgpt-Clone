[CmdletBinding()]
param(
    [string]$Repository = 'shivamvku/BY-chatgpt-Clone',
    [string]$BudgetEmail
)
$ErrorActionPreference = 'Stop'
$bootstrapDirectory = Join-Path $PSScriptRoot '../bootstrap'
$variablesJson = & terraform "-chdir=$bootstrapDirectory" output -json github_variables
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap outputs unavailable' }
$variables = $variablesJson | ConvertFrom-Json
if (-not $BudgetEmail) {
    $BudgetEmail = az account show --query user.name -o tsv
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve a budget contact; pass BudgetEmail explicitly' }
}
if ($BudgetEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    throw 'Pass a valid budget notification email with BudgetEmail'
}
gh variable set AZURE_BUDGET_ALERT_EMAIL --repo $Repository --body $BudgetEmail
if ($LASTEXITCODE -ne 0) { throw 'Cannot set the budget notification contact' }
foreach ($property in $variables.PSObject.Properties) {
    gh variable set $property.Name --repo $Repository --body $property.Value
    if ($LASTEXITCODE -ne 0) { throw "Failed setting $($property.Name)" }
}
foreach ($environment in @('infra-plan','infra-deploy')) {
    gh api --method PUT "repos/$Repository/environments/$environment" --input (Join-Path $PSScriptRoot '../config/github-environment.json')
    if ($LASTEXITCODE -ne 0) { throw "Failed creating $environment" }
}

$defaultBranch = gh repo view $Repository --json defaultBranchRef --jq '.defaultBranchRef.name'
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve default branch' }
$policyFile = [IO.Path]::GetTempFileName()
try {
    $policyJson = @{ name = $defaultBranch; type = 'branch' } | ConvertTo-Json
    [IO.File]::WriteAllText($policyFile, $policyJson, [Text.UTF8Encoding]::new($false))
    foreach ($environment in @('infra-plan','infra-deploy')) {
        $policies = gh api "repos/$Repository/environments/$environment/deployment-branch-policies" --jq '.branch_policies[].name'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot read deployment branch policies' }
        if ($defaultBranch -notin $policies) {
            gh api --method POST "repos/$Repository/environments/$environment/deployment-branch-policies" --input $policyFile
            if ($LASTEXITCODE -ne 0) { throw 'Cannot set deployment branch policy' }
        }
    }
} finally { Remove-Item -LiteralPath $policyFile }
