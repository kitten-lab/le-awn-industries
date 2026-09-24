$ports = 43167,43168,43171,43172
foreach ($p in $ports) {
  $name = "El Desk LAN $p"
  if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p -Profile Any | Out-Null
    Write-Host "added $p"
  } else { Write-Host "exists $p" }
}
