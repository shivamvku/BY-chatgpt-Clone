mock_provider "azurerm" {}
run "restricted_management_ssh" {
  command = plan
  module { source = "../../../modules/db-access" }
  variables {
    name                = "test"
    location            = "centralus"
    resource_group_name = "test-rg"
    tags                = {}
    vnet_name           = "test-vnet"
    allowed_cidr        = "203.0.113.10/32"
    public_key          = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB terraform-policy-test"
    vm_size             = "Standard_B1s"
    username            = "dbaccess"
    shutdown_time       = "2300"
    shutdown_timezone   = "India Standard Time"
  }
  override_resource {
    override_during = plan
    target          = azurerm_linux_virtual_machine.ssh
    values          = { id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/test" }
  }
  assert {
    condition     = azurerm_linux_virtual_machine.ssh.disable_password_authentication
    error_message = "Management VM must use SSH keys."
  }
  assert {
    condition     = length([for rule in azurerm_network_security_group.management.security_rule : rule if rule.name == "OperatorSSH" && rule.source_address_prefix == "203.0.113.10/32" && rule.destination_port_range == "22"]) == 1
    error_message = "SSH must be limited to the operator's exact IP."
  }
  assert {
    condition     = azurerm_dev_test_global_vm_shutdown_schedule.ssh.enabled
    error_message = "Management VM must have automatic shutdown configured."
  }
}
