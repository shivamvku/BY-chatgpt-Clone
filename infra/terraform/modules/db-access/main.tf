resource "azurerm_subnet" "management" {
  name                 = "database-management"
  resource_group_name  = var.resource_group_name
  virtual_network_name = var.vnet_name
  address_prefixes     = ["10.42.3.0/24"]
}
resource "azurerm_public_ip" "ssh" {
  name                = "${var.name}-db-access-ip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}
resource "azurerm_network_security_group" "management" {
  name                = "${var.name}-db-access-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
  security_rule {
    name                       = "OperatorSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.allowed_cidr
    destination_address_prefix = "10.42.3.0/24"
  }
  security_rule {
    name                       = "DenyOtherInbound"
    priority                   = 200
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}
resource "azurerm_subnet_network_security_group_association" "management" {
  subnet_id                 = azurerm_subnet.management.id
  network_security_group_id = azurerm_network_security_group.management.id
}
resource "azurerm_network_interface" "ssh" {
  name                = "${var.name}-db-access-nic"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
  ip_configuration {
    name                          = "management"
    subnet_id                     = azurerm_subnet.management.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.ssh.id
  }
}
resource "azurerm_linux_virtual_machine" "ssh" {
  name                            = "${var.name}-db-access"
  location                        = var.location
  resource_group_name             = var.resource_group_name
  size                            = var.vm_size
  admin_username                  = var.username
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.ssh.id]
  tags                            = var.tags
  admin_ssh_key {
    username   = var.username
    public_key = var.public_key
  }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
  lifecycle {
    precondition {
      condition     = var.allowed_cidr != "" && var.public_key != ""
      error_message = "Database access requires the operator /32 IP and SSH public key."
    }
  }
  depends_on = [azurerm_subnet_network_security_group_association.management]
}
resource "azurerm_dev_test_global_vm_shutdown_schedule" "ssh" {
  virtual_machine_id    = azurerm_linux_virtual_machine.ssh.id
  location              = var.location
  enabled               = true
  daily_recurrence_time = var.shutdown_time
  timezone              = var.shutdown_timezone
  notification_settings { enabled = false }
  tags = var.tags
}
output "ssh_host" { value = azurerm_public_ip.ssh.ip_address }
