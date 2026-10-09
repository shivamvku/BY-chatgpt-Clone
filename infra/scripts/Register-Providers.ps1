[CmdletBinding()]
param(
    [string[]]$Namespaces = @(
        'Microsoft.App',
        'Microsoft.OperationalInsights',
        'Microsoft.ContainerRegistry',
        'Microsoft.DBforPostgreSQL',
        'Microsoft.KeyVault',
        'Microsoft.Storage',
        'Microsoft.Network',
        'Microsoft.ManagedIdentity',
        'Microsoft.Insights',
        'Microsoft.Consumption',
        'Microsoft.BillingBenefits',
        'Microsoft.CognitiveServices'
    )
)
$ErrorActionPreference = 'Stop'
foreach ($provider in $Namespaces) {
    Write-Output "Registering $provider"
    az provider register --namespace $provider --wait --output none
    if ($LASTEXITCODE -ne 0) { throw "Provider registration failed: $provider" }
}

